import {
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { UserContext } from '../auth/user-context.types';
import { WalletBalanceResponseDto } from './dto/wallet-balance-response.dto';
import { WALLET_PORT, WalletReserveError } from './wallet.port';
import type { WalletPort } from './wallet.port';

@Injectable()
export class WalletService {
  constructor(@Inject(WALLET_PORT) private readonly wallet: WalletPort) {}

  async getBalance(user: UserContext): Promise<WalletBalanceResponseDto> {
    try {
      return await this.wallet.getBalance(user.username, user.casinoGroupId);
    } catch (error) {
      if (error instanceof WalletReserveError) {
        throw new ServiceUnavailableException(error.message);
      }
      throw error;
    }
  }
}
