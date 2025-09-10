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
      '--amount <amount>',
      'Amount of tokens we have to withdraw (e.g. --amount 123JLP)',
    )
    .action(async (options) => {
      await createJupiterHelperAltTableIfNotExist(alt, jupiterHelper.app);
      const coin = jupiterHelperCommandValidator.validateJlpAmount(
        options.amount,
      );
      console.log(coin);
    });
}
