import { Alt, createJupiterHelperAltTableIfNotExist } from '@lib/alt';
import { Command } from 'commander';
import { Logger } from 'pino';
import { BaseApp } from '@config/config';
import { JupiterHelper } from '@lib/jupiter_helper';

export function registerJupiterHelperProcessCommand(
  alt: Alt,
  program: Command,
  logger: Logger,
  baseApp: BaseApp,
  jupiterHelper: JupiterHelper,
) {
  program
    .command('jupiter-helper-process')
    .description('Call process method on the Jupiter Helper')
    .requiredOption(
      '--amount <amount>',
      'Amount of tokens we have to provide/withdraw (e.g. --amount 123)',
    )
    .requiredOption('--type <type>', 'provider/withdrawer')
    .requiredOption('--asset <asset>', 'Asset that we wish to provide/withdraw')
    .action(async (options) => {
      await createJupiterHelperAltTableIfNotExist(alt, jupiterHelper.app);
    });
}
