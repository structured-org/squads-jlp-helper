import { Alt, createJupiterHelperAltTableIfNotExist } from '@lib/alt';
import { Command } from 'commander';
import { Logger } from 'pino';
import { BaseApp } from '@config/config';
import { JupiterHelper } from '@lib/jupiter_helper';
import { JupiterHelperCommandValidator } from '@lib/validator';
import { web3 } from '@project-serum/anchor';
import { compileTransactionMessageWithAlt } from '@lib/helpers';
import { ComputeBudgetProgram } from '@solana/web3.js';

export function registerJupiterHelperProcessWithdrawCommand(
  alt: Alt,
  program: Command,
  logger: Logger,
  baseApp: BaseApp,
  jupiterHelperCommandValidator: JupiterHelperCommandValidator,
  jupiterHelper: JupiterHelper,
) {
  program
    .command('jupiter-helper-process-withdraw')
    .description('Call process method on the Jupiter Helper')
    .requiredOption(
      '--lpAmountIn <lpAmountIn>',
      'Amount of tokens we have to withdraw (e.g. --lpAmountIn 123JLP)',
    )
    .requiredOption(
      '--assetOut <assetOut>',
      'Denom of the token that we expect to get back',
    )
    .action(async (options) => {
      await createJupiterHelperAltTableIfNotExist(alt, jupiterHelper.app);
      jupiterHelperCommandValidator.validateAssetOut(options.assetOut);
      const coin = jupiterHelperCommandValidator.validateJlpAmount(
        options.lpAmountIn,
      );
      const processIx = await jupiterHelper.processIx(
        coin.amount.toNumber(),
        options.assetOut,
        'withdrawer',
      );
      const messageV0 = await compileTransactionMessageWithAlt(
        baseApp.anchorProvider,
        [
          ComputeBudgetProgram.setComputeUnitLimit({
            units: 1_400_000,
          }),
          processIx,
        ],
        baseApp.keypair.publicKey,
        jupiterHelper.app.altTable,
      );
      const tx = new web3.VersionedTransaction(messageV0);
      const res =
        await baseApp.anchorProvider.connection.simulateTransaction(tx);
      console.log(res);
      // const res = await simulateAndBroadcastVersionedTx(
      //   baseApp.anchorProvider,
      //   tx,
      //   'jupiter helper process',
      //   logger,
      // );
      // console.log(res);
    });
}
