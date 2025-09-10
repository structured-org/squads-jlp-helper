import { Alt, createJupiterHelperAltTableIfNotExist } from '@lib/alt';
import { Command } from 'commander';
import { Logger } from 'pino';
import { BaseApp } from '@config/config';
import { JupiterHelper } from '@lib/jupiter_helper';
import { JupiterHelperCommandValidator } from '@lib/validator';

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

      console.log(coin);
    });
}
