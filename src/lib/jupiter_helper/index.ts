import { Logger } from 'pino';
import {
  BaseApp,
  JupiterHelperApp,
  JupiterHelperDepenedentAccounts,
  JupiterPerpetualsDepenedentAccounts,
} from '@config/config';
import { BN, Program, web3 } from '@project-serum/anchor';
import { Program as CoralProgram, utils } from '@coral-xyz/anchor';
import { getAssociatedTokenAddressSync, getMint } from '@solana/spl-token';
import {
  getAssetUnderManagementUsdForCustody,
  PriceCalcMode,
} from '@lib/jupiter_helper/internal';
import Decimal from 'decimal.js';
import fs from 'fs';

export class JupiterHelper {
  private perpsProgramInstance: Program;
  private helperProgramInstance: CoralProgram;

  constructor(
    private logger: Logger,
    private baseApp: BaseApp,
    private jupiterHelperApp: JupiterHelperApp,
  ) {}

  async init() {
    this.perpsProgramInstance = new Program(
      // await Program.fetchIdl(
      //   this.app.jpAccounts.program,
      //   this.baseApp.anchorProvider,
      // ),
      JSON.parse(
        fs.readFileSync('/home/vfaust/Downloads/perpetuals.json', {
          encoding: 'utf-8',
        }),
      ),
      this.app.jpAccounts.program,
      this.baseApp.anchorProvider,
    );
    this.helperProgramInstance = new CoralProgram(
      // await Program.fetchIdl(this.app.program, this.baseApp.anchorProvider),
      JSON.parse(
        fs.readFileSync(
          '/home/vfaust/sandbox/maxbtc-solana/target/idl/jupiter_helper.json',
          {
            encoding: 'utf-8',
          },
        ),
      ),
    );
  }

  async withdrawAssetIx(
    jupiterHelperDependentAccounts: JupiterHelperDepenedentAccounts,
    recipientAta: web3.PublicKey,
    withdrawMint: web3.PublicKey,
    from: web3.PublicKey,
    amount?: number,
  ): Promise<web3.TransactionInstruction> {
    return await this.helperProgramInstance.methods
      .withdrawAsset({
        amount: amount ? new BN(amount) : null,
      })
      .accounts({
        mint: withdrawMint,
        helperConfig: jupiterHelperDependentAccounts.config,
        helperVault: jupiterHelperDependentAccounts.vault,
        recipientAta: recipientAta,
        ownership: jupiterHelperDependentAccounts.ownership,
        signer: from,
      })
      .instruction();
  }

  get app(): JupiterHelperApp {
    return this.jupiterHelperApp;
  }

  async getFeeBpsEach(txhash: string, length: number): Promise<Array<number>> {
    const res: Array<number> = [];
    for (;;) {
      const tx = await this.baseApp.anchorProvider.connection.getTransaction(
        txhash,
        {
          commitment: 'confirmed',
          maxSupportedTransactionVersion: 0,
        },
      );
      if (tx != null) {
        for (let i = 0; i < length; i++) {
          const eventIx = tx.meta.innerInstructions[i].instructions[3];
          const rawData = utils.bytes.bs58.decode(eventIx.data);
          const base64Data = utils.bytes.base64.encode(rawData.subarray(8));
          const event =
            this.perpsProgramInstance.coder.events.decode(base64Data);
          const feeBps = (event.data.feeBps as BN).toNumber();
          res.push(Number(feeBps));
        }
        break;
      }
      await new Promise((r) => setTimeout(r, 200));
    }

    return res;
  }

  async getCustodyAum(
    jupiterPerpetualsDepenedentAccounts: JupiterPerpetualsDepenedentAccounts,
    mode: PriceCalcMode,
  ): Promise<number> {
    const custody = this.perpsProgramInstance.coder.accounts.decode(
      'Custody',
      (
        await this.baseApp.anchorProvider.connection.getAccountInfo(
          jupiterPerpetualsDepenedentAccounts.custody,
        )
      ).data,
    );
    const dovesProgramInstance = new Program(
      // await Program.fetchIdl(
      //   'DoVEsk76QybCEHQGzkvYPWLQu9gzNoZZZt3TPiL597e',
      //   this.baseApp.anchorProvider,
      // ),
      JSON.parse(
        fs.readFileSync('/home/vfaust/Downloads/doves.json', {
          encoding: 'utf-8',
        }),
      ),
      this.app.jpAccounts.program,
      this.baseApp.anchorProvider,
    );
    const priceFeed = dovesProgramInstance.coder.accounts.decode(
      'AgPriceFeed',
      (
        await this.baseApp.anchorProvider.connection.getAccountInfo(
          jupiterPerpetualsDepenedentAccounts.custodyDovesPriceAccount,
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

  async getOptimalAmounts(
    safetyMargin: number,
    tokenAmountIn: number,
    assetOut: string,
  ): Promise<Array<number>> {
    if (safetyMargin > 10000 || safetyMargin < 0) {
      throw new Error('Safety margin must be between 0 and 10000');
    }
    const jupiterPerpetualsDepenedentAccounts: JupiterPerpetualsDepenedentAccounts =
      this.app.jpAccounts.dependentAccounts.get(assetOut);
    const pool = this.perpsProgramInstance.coder.accounts.decode(
      'Pool',
      (
        await this.baseApp.anchorProvider.connection.getAccountInfo(
          this.app.jpAccounts.pool,
        )
      ).data,
    );
    const custody = this.perpsProgramInstance.coder.accounts.decode(
      'Custody',
      (
        await this.baseApp.anchorProvider.connection.getAccountInfo(
          jupiterPerpetualsDepenedentAccounts.custody,
        )
      ).data,
    );

    const swapMultiplier = custody.isStable
      ? new Decimal(pool.fees.stableSwapMultiplier.toNumber())
      : new Decimal(pool.fees.swapMultiplier.toNumber());
    const poolAumUsdPreCalc = await this.getPoolAum('Min');

    const custodyAum = await this.getCustodyAum(
      jupiterPerpetualsDepenedentAccounts,
      custody,
    );
    const jlpToken = await getMint(
      this.baseApp.anchorProvider.connection,
      this.app.jpAccounts.lpTokenMint,
    );

    let custodyAumUsdDeduct = new Decimal(0);
    let poolAumUsdDeduct = new Decimal(0);
    let jlpTotalSupplyDeduct = new Decimal(0);

    const tokenAmountsIn: Array<number> = [];
    while (tokenAmountIn > 0) {
      const poolAumUsd = new Decimal(poolAumUsdPreCalc)
        .div(new Decimal(10).pow(6))
        .sub(poolAumUsdDeduct);

      const currentUsd = new Decimal(custodyAum)
        .div(new Decimal(10).pow(6))
        .sub(custodyAumUsdDeduct);

      const lpTokenDecimals = new Decimal(10).pow(jlpToken.decimals);
      let totalSupplyJlp = new Decimal(jlpToken.supply.toString()).sub(
        jlpTotalSupplyDeduct,
      );

      let targetUsd = poolAumUsd
        .mul(new Decimal(custody.targetRatioBps.toNumber()))
        .div(10000);
      let initialDiffUsd = currentUsd.sub(targetUsd);
      if (initialDiffUsd.isNegative()) {
        throw new Error('Initial diff is negative');
      }

      let maxDiscountDepositUsd = initialDiffUsd.mul(2).div(swapMultiplier);

      let jlpVirtualPriceUsd = poolAumUsd
        .div(totalSupplyJlp)
        .mul(lpTokenDecimals);
      let optimalAmountJlp = maxDiscountDepositUsd
        .div(jlpVirtualPriceUsd)
        .mul(lpTokenDecimals);

      const updatedPoolAumUsd = poolAumUsd.sub(maxDiscountDepositUsd);
      targetUsd = updatedPoolAumUsd
        .mul(new Decimal(custody.targetRatioBps.toNumber()))
        .div(10000);
      initialDiffUsd = targetUsd.sub(currentUsd).abs();
      maxDiscountDepositUsd = initialDiffUsd.mul(2).div(swapMultiplier);

      totalSupplyJlp = totalSupplyJlp.sub(optimalAmountJlp);
      jlpVirtualPriceUsd = updatedPoolAumUsd
        .div(totalSupplyJlp)
        .mul(lpTokenDecimals);
      optimalAmountJlp = maxDiscountDepositUsd
        .div(jlpVirtualPriceUsd)
        .mul(lpTokenDecimals);

      const optimalAmountJlpIn = optimalAmountJlp
        .mul((10_000 - safetyMargin) / 10_000)
        .floor()
        .toNumber();
      const jlpIn =
        tokenAmountIn - optimalAmountJlpIn < 0
          ? tokenAmountIn
          : optimalAmountJlpIn;

      tokenAmountsIn.push(jlpIn);
      tokenAmountIn -= jlpIn;

      custodyAumUsdDeduct = custodyAumUsdDeduct.add(
        maxDiscountDepositUsd.sub(
          maxDiscountDepositUsd.mul(new Decimal(safetyMargin / 10000)),
        ),
      );
      poolAumUsdDeduct = poolAumUsdDeduct.add(
        maxDiscountDepositUsd.sub(
          maxDiscountDepositUsd.mul(new Decimal(safetyMargin / 10000)),
        ),
      );
      jlpTotalSupplyDeduct = jlpTotalSupplyDeduct.add(
        optimalAmountJlp.sub(
          optimalAmountJlp.mul(new Decimal(safetyMargin / 10000)),
        ),
      );
    }

    return tokenAmountsIn;
  }

  async getPoolAum(mode: PriceCalcMode): Promise<number> {
    let res = 0;
    for (const asset of ['USDC', 'USDT', 'WBTC', 'WETH', 'WSOL']) {
      res += await this.getCustodyAum(
        this.app.jpAccounts.dependentAccounts.get(asset),
        mode,
      );
    }
    return res;
  }

  async processIx(
    lpAmountIn: number,
    denomOut: string,
    mode: 'withdrawer' | 'provider',
  ): Promise<web3.TransactionInstruction> {
    const jpDependentAccounts =
      this.app.jpAccounts.dependentAccounts.get(denomOut);
    const jhDependentAccounts = this.app.jhAccounts.get(denomOut);
    const helperConfigData = this.helperProgramInstance.coder.accounts.decode(
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
      return await this.helperProgramInstance.methods
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
