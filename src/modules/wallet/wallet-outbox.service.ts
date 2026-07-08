import { randomUUID } from 'crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { BetStatus, WalletOutboxStatus } from '@prisma/client';
import { PrismaService } from '../../shared/database/prisma.service';
import { buildBetDebitTransaction } from './wallet-transaction.builder';
import { newWalletTransactionCode } from './wallet-transaction-code';
import { WALLET_PORT, WalletReserveError } from './wallet.port';
import type { WalletPort } from './wallet.port';
import {
  WALLET_OUTBOX_DEBIT,
  WALLET_OUTBOX_SETTLE,
  WALLET_OUTBOX_STAFF_VOID,
  deserializeWalletTransaction,
} from './wallet-outbox.types';

const DEBIT_BATCH_LIMIT = 20;

@Injectable()
export class WalletOutboxService {
  private readonly logger = new Logger(WalletOutboxService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(WALLET_PORT) private readonly wallet: WalletPort,
  ) {}

  /** Worker entry: debits, staff voids, then settlement batches. */
  async processPending(): Promise<number> {
    let processed = 0;
    processed += await this.processPendingDebits(DEBIT_BATCH_LIMIT);
    processed += await this.processPendingStaffVoids(DEBIT_BATCH_LIMIT);
    processed += await this.flushSettlementBatches();
    return processed;
  }

  /** Flush all due settlement batches for one tenant (e.g. staff manual retry). */
  async flushSettlementBatchesForCasinoGroup(
    casinoGroupId: string,
  ): Promise<number> {
    let batches = 0;
    while (await this.flushSettlementBatchForGroup(casinoGroupId)) {
      batches += 1;
      if (batches >= 100) {
        this.logger.warn(
          `Stopped wallet settlement flush after 100 batches for ${casinoGroupId}`,
        );
        break;
      }
    }
    return batches;
  }

  /** Called at end of a settlement run after all bets are persisted. */
  async flushSettlementBatches(): Promise<number> {
    const now = new Date();
    const groups = await this.prisma.walletOutbox.findMany({
      where: {
        type: WALLET_OUTBOX_SETTLE,
        status: WalletOutboxStatus.PENDING,
        OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }],
      },
      select: { casinoGroupId: true },
      distinct: ['casinoGroupId'],
    });

    let batches = 0;
    for (const { casinoGroupId } of groups) {
      const sent = await this.flushSettlementBatchForGroup(casinoGroupId);
      if (sent) {
        batches += 1;
      }
    }
    return batches;
  }

  async processDebitForBet(betId: string) {
    return this.processSingleDebit(betId);
  }

  private async processPendingDebits(limit: number): Promise<number> {
    const now = new Date();
    const entries = await this.prisma.walletOutbox.findMany({
      where: {
        type: WALLET_OUTBOX_DEBIT,
        status: WalletOutboxStatus.PENDING,
        OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }],
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
      select: { betId: true },
    });

    let processed = 0;
    for (const entry of entries) {
      try {
        await this.processSingleDebit(entry.betId);
        processed += 1;
      } catch (error) {
        if (!(error instanceof WalletReserveError)) {
          this.logger.warn(
            `Debit outbox for bet ${entry.betId}: ${(error as Error).message}`,
          );
        }
      }
    }
    return processed;
  }

  private async processPendingStaffVoids(limit: number): Promise<number> {
    const now = new Date();
    const entries = await this.prisma.walletOutbox.findMany({
      where: {
        type: WALLET_OUTBOX_STAFF_VOID,
        status: WalletOutboxStatus.PENDING,
        OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }],
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });

    let processed = 0;
    for (const entry of entries) {
      try {
        const transaction = deserializeWalletTransaction(entry.payload);
        await this.wallet.postTransaction(transaction);
        await this.prisma.walletOutbox.update({
          where: { id: entry.id },
          data: { status: WalletOutboxStatus.COMPLETED, lastError: null },
        });
        processed += 1;
      } catch (error) {
        await this.scheduleRetry(entry.id, entry.attempts, error);
      }
    }
    return processed;
  }

  private async processSingleDebit(betId: string) {
    const bet = await this.prisma.bet.findUnique({
      where: { id: betId },
      include: { legs: true },
    });
    if (!bet) {
      throw new Error(`Bet ${betId} not found`);
    }
    if (bet.status === BetStatus.ACCEPTED || bet.status === BetStatus.REJECTED) {
      return bet;
    }

    const outbox = await this.prisma.walletOutbox.findUnique({
      where: {
        betId_type: { betId, type: WALLET_OUTBOX_DEBIT },
      },
    });
    if (!outbox || outbox.status === WalletOutboxStatus.COMPLETED) {
      return bet;
    }

    let transactionCode = outbox.transactionCode;
    if (!transactionCode) {
      transactionCode = newWalletTransactionCode();
      await this.prisma.walletOutbox.update({
        where: { id: outbox.id },
        data: { transactionCode },
      });
    }

    const transaction = buildBetDebitTransaction({
      bet,
      legs: bet.legs,
      transactionCode,
    });

    try {
      const result = await this.wallet.postTransaction(transaction);
      return await this.prisma.$transaction(async (tx) => {
        const updated = await tx.bet.update({
          where: { id: betId },
          data: {
            status: BetStatus.ACCEPTED,
            walletReservationId: result.transactionId,
            rejectionReason: null,
          },
          include: { legs: true },
        });
        await tx.walletOutbox.update({
          where: { id: outbox.id },
          data: { status: WalletOutboxStatus.COMPLETED, lastError: null },
        });
        return updated;
      });
    } catch (error) {
      if (
        error instanceof WalletReserveError &&
        error.code === 'INSUFFICIENT_FUNDS'
      ) {
        return this.rejectBet(betId, error.message, outbox.id);
      }
      await this.scheduleRetry(outbox.id, outbox.attempts, error);
      throw error;
    }
  }

  private async flushSettlementBatchForGroup(
    casinoGroupId: string,
  ): Promise<boolean> {
    const now = new Date();
    const anchor = await this.prisma.walletOutbox.findFirst({
      where: {
        casinoGroupId,
        type: WALLET_OUTBOX_SETTLE,
        status: WalletOutboxStatus.PENDING,
        OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }],
      },
      orderBy: { createdAt: 'asc' },
      select: { batchId: true },
    });

    if (!anchor) {
      return false;
    }

    const batchId = anchor.batchId ?? randomUUID();
    const entries = await this.prisma.walletOutbox.findMany({
      where: {
        casinoGroupId,
        type: WALLET_OUTBOX_SETTLE,
        status: WalletOutboxStatus.PENDING,
        OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }],
        batchId: anchor.batchId,
      },
      orderBy: { createdAt: 'asc' },
    });

    if (entries.length === 0) {
      return false;
    }

    if (anchor.batchId === null) {
      await this.prisma.walletOutbox.updateMany({
        where: { id: { in: entries.map((entry) => entry.id) } },
        data: { batchId },
      });
    }

    const transactions = entries.map((entry) =>
      deserializeWalletTransaction(entry.payload),
    );

    try {
      await this.wallet.postTransactionBatch({
        casinoGroupId,
        batchId,
        transactions,
      });
      await this.prisma.walletOutbox.updateMany({
        where: { id: { in: entries.map((entry) => entry.id) } },
        data: {
          status: WalletOutboxStatus.COMPLETED,
          batchId,
          lastError: null,
        },
      });
      this.logger.log(
        `Wallet settlement batch ${batchId} delivered ${entries.length} transaction(s) for ${casinoGroupId}`,
      );
      return true;
    } catch (error) {
      for (const entry of entries) {
        await this.scheduleRetry(entry.id, entry.attempts, error);
      }
      this.logger.warn(
        `Settlement batch ${batchId} failed for ${casinoGroupId}: ${
          (error as Error).message
        }`,
      );
      return false;
    }
  }

  private async rejectBet(betId: string, reason: string, outboxId: string) {
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.bet.update({
        where: { id: betId },
        data: {
          status: BetStatus.REJECTED,
          rejectionReason: reason,
        },
        include: { legs: true },
      });
      await tx.walletOutbox.update({
        where: { id: outboxId },
        data: {
          status: WalletOutboxStatus.FAILED,
          lastError: reason,
        },
      });
      return updated;
    });
  }

  private async scheduleRetry(
    outboxId: string,
    attempts: number,
    error: unknown,
  ): Promise<void> {
    const message =
      error instanceof Error ? error.message : 'Wallet delivery failed';
    const nextAttempts = attempts + 1;
    const delaySeconds = Math.min(60 * nextAttempts, 900);
    await this.prisma.walletOutbox.update({
      where: { id: outboxId },
      data: {
        attempts: nextAttempts,
        lastError: message,
        nextRetryAt: new Date(Date.now() + delaySeconds * 1000),
      },
    });
  }
}
