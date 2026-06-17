import { WalletOutboxStatus } from '@prisma/client';
import { PrismaService } from '../../shared/database/prisma.service';
import type { WalletPort } from './wallet.port';
import { WalletOutboxService } from './wallet-outbox.service';
import {
  WALLET_OUTBOX_SETTLE,
  serializeWalletTransaction,
} from './wallet-outbox.types';

describe('WalletOutboxService settlement batches', () => {
  const casinoGroupId = 'acme';
  const batchId = 'batch-1';

  let wallet: jest.Mocked<Pick<WalletPort, 'postTransactionBatch'>>;
  let prisma: {
    walletOutbox: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      updateMany: jest.Mock;
      update: jest.Mock;
    };
  };
  let service: WalletOutboxService;

  const settlementPayload = serializeWalletTransaction({
    userCode: 'player1',
    casinoGroupId,
    roundId: 'bet-1',
    transactionCode: 'settle-code-1',
    historyId: 123,
    gameCode: 'basketball_nba',
    gameType: 1,
    isFinished: true,
    isCanceled: false,
    amount: '10.00',
    detail: 'WON',
    createdAt: new Date('2026-06-04T12:00:00.000Z'),
  });

  beforeEach(() => {
    wallet = {
      postTransactionBatch: jest.fn().mockResolvedValue({ batchId }),
    };
    prisma = {
      walletOutbox: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn(),
      },
    };
    service = new WalletOutboxService(
      prisma as unknown as PrismaService,
      wallet as unknown as WalletPort,
    );
  });

  it('sends one batch per tenant and marks outbox rows completed', async () => {
    const entry = {
      id: 'outbox-1',
      betId: 'bet-1',
      casinoGroupId,
      type: WALLET_OUTBOX_SETTLE,
      transactionCode: 'settle-code-1',
      batchId,
      payload: settlementPayload,
      status: WalletOutboxStatus.PENDING,
      attempts: 0,
    };

    prisma.walletOutbox.findMany
      .mockResolvedValueOnce([{ casinoGroupId }])
      .mockResolvedValueOnce([entry]);
    prisma.walletOutbox.findFirst.mockResolvedValue({ batchId });

    const batches = await service.flushSettlementBatches();

    expect(batches).toBe(1);
    expect(wallet.postTransactionBatch).toHaveBeenCalledWith({
      casinoGroupId,
      batchId,
      transactions: [
        expect.objectContaining({
          transactionCode: 'settle-code-1',
          roundId: 'bet-1',
        }),
      ],
    });
    expect(prisma.walletOutbox.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['outbox-1'] } },
      data: {
        status: WalletOutboxStatus.COMPLETED,
        batchId,
        lastError: null,
      },
    });
  });

  it('schedules retry without completing rows when batch delivery fails', async () => {
    const entry = {
      id: 'outbox-2',
      betId: 'bet-2',
      casinoGroupId,
      type: WALLET_OUTBOX_SETTLE,
      transactionCode: 'settle-code-2',
      batchId,
      payload: settlementPayload,
      status: WalletOutboxStatus.PENDING,
      attempts: 1,
    };

    wallet.postTransactionBatch.mockRejectedValue(new Error('wallet down'));
    prisma.walletOutbox.findMany
      .mockResolvedValueOnce([{ casinoGroupId }])
      .mockResolvedValueOnce([entry]);
    prisma.walletOutbox.findFirst.mockResolvedValue({ batchId });

    const batches = await service.flushSettlementBatches();

    expect(batches).toBe(0);
    expect(prisma.walletOutbox.updateMany).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: WalletOutboxStatus.COMPLETED,
        }),
      }),
    );
    expect(prisma.walletOutbox.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'outbox-2' },
        data: expect.objectContaining({
          attempts: 2,
          lastError: 'wallet down',
          nextRetryAt: expect.any(Date),
        }),
      }),
    );
  });
});
