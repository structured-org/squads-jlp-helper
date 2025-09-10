import { Logger } from 'pino';
import {
  BaseApp,
  JupiterHelperApp,
  JupiterHelperDepenedentAccounts,
} from '@config/config';
import { BN, Program, web3 } from '@project-serum/anchor';
import { Program as CoralProgram } from '@coral-xyz/anchor';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';
import {
  getAssetUnderManagementUsdForCustody,
  PriceCalcMode,
} from '@lib/jupiter_helper/internal';

export class JupiterHelper {
  constructor(
    private logger: Logger,
    private baseApp: BaseApp,
    private jupiterHelperApp: JupiterHelperApp,
  ) {}

  get app(): JupiterHelperApp {
    return this.jupiterHelperApp;
  }

  async getCustodyAum(
    jupiterHelperDependentAccounts: JupiterHelperDepenedentAccounts,
    mode: PriceCalcMode,
  ): Promise<number> {
    const perpsProgramInstance = new Program(
      await Program.fetchIdl(
        this.app.jpAccounts.program,
        this.baseApp.anchorProvider,
      ),
      this.app.jpAccounts.program,
      this.baseApp.anchorProvider,
    );
    const custody = perpsProgramInstance.coder.accounts.decode(
      'Custody',
      (
        await this.baseApp.anchorProvider.connection.getAccountInfo(
          jupiterHelperDependentAccounts.custody,
        )
      ).data,
    );
    const dovesProgramInstance = new Program(
      await Program.fetchIdl(
        'DoVEsk76QybCEHQGzkvYPWLQu9gzNoZZZt3TPiL597e',
        this.baseApp.anchorProvider,
      ),
      this.app.jpAccounts.program,
      this.baseApp.anchorProvider,
    );
    const priceFeed = dovesProgramInstance.coder.accounts.decode(
      'AgPriceFeed',
      (
        await this.baseApp.anchorProvider.connection.getAccountInfo(
          jupiterHelperDependentAccounts.custodyDovesPriceAccount,
        )
      ).data,
    );
    return getAssetUnderManagementUsdForCustody(
      custody,
      {
        price: priceFeed.price,
        exponent: priceFeed['expo'],
      },
      mode,
    ).toNumber();
  }

  async processIx(
    lpAmountIn: number,
    denomOut: string,
    mode: 'withdrawer' | 'provider',
  ): Promise<web3.TransactionInstruction> {
    const program = new CoralProgram(
      await Program.fetchIdl(this.app.program, this.baseApp.anchorProvider),
    );
    const jpDependentAccounts =
      this.app.jpAccounts.dependentAccounts.get(denomOut);
    const jhDependentAccounts = this.app.jhAccounts.get(denomOut);
    const helperConfigData = program.coder.accounts.decode(
      'helperConfig',
      (
        await this.baseApp.anchorProvider.connection.getAccountInfo(
          mode === 'withdrawer'
            ? jhDependentAccounts.withdrawer.config
            : jhDependentAccounts.provider.config,
        )
      ).data,
    );

    if (mode === 'withdrawer') {
      return await program.methods
        .process({
          tokenAmountIn: new BN(lpAmountIn),
        })
        .accounts({
          jupiterPerpetualsAccounts: {
            transferAuthority: this.app.jpAccounts.transferAuthority,
            perpetuals: this.app.jpAccounts.perpetuals,
            pool: this.app.jpAccounts.pool,
            custody: jpDependentAccounts.custody,
            custodyDovesPriceAccount:
              jpDependentAccounts.custodyDovesPriceAccount,
            custodyPythnetPriceAccount:
              jpDependentAccounts.custodyPythnetPriceAccount,
            custodyTokenAccount: jpDependentAccounts.custodyTokenAccount,
            eventAuthority: this.app.jpAccounts.eventAuthority,
            program: this.app.jpAccounts.program,
          },
          lpTokenMint: this.app.jpAccounts.lpTokenMint,
          mint: this.app.mints[denomOut],
          helperConfig: jhDependentAccounts.withdrawer.config,
          helperVault: jhDependentAccounts.withdrawer.vault,
          helperOwnership: jhDependentAccounts.withdrawer.ownership,
          recipientAta: getAssociatedTokenAddressSync(
            this.app.mints[denomOut],
            helperConfigData.recipient,
            true,
          ),
          recipientAtaLp: getAssociatedTokenAddressSync(
            this.app.jpAccounts.lpTokenMint,
            helperConfigData.recipient,
            true,
          ),
        })
        .remainingAccounts(
          this.app.jpAccounts.remainingAccounts.map((account) => ({
            pubkey: new web3.PublicKey(account),
            isWritable: false,
            isSigner: false,
          })),
        )
        .instruction();
    }
  }
}
