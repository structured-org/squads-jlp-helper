import { Alt, createJupiterHelperAltTableIfNotExist } from '@lib/alt';
import { Command } from 'commander';
import { Logger } from 'pino';
import { BaseApp } from '@config/config';
import { JupiterHelper } from '@lib/jupiter_helper';
import { JupiterHelperCommandValidator } from '@lib/validator';

export function registerJupiterHelperProcessCommand(
  alt: Alt,
  program: Command,
  logger: Logger,
  baseApp: BaseApp,
  jupiterHelperCommandValidator: JupiterHelperCommandValidator,
  jupiterHelper: JupiterHelper,
) {
  program
    .command('jupiter-helper-process')
    .description('Call process method on the Jupiter Helper')
    .requiredOption(
      '--amount <amount>',
      'Amount of tokens we have to provide/withdraw (e.g. --amount 123USDC)',
    )
    .requiredOption('--type <type>', 'provider/withdrawer')
    .action(async (options) => {
      await createJupiterHelperAltTableIfNotExist(alt, jupiterHelper.app);
      let coin;
      if (options.type !== 'provider' && options.type !== 'withdrawer') {
        this.logger.error(`--type: No such type -- ${options.type}`);
        process.exit(-1);
      }
      if (options.type === 'withdrawer') {
        coin = jupiterHelperCommandValidator.validateJlpAmount(options.amount);
      }
      if (options.type === 'provider') {
        coin = jupiterHelperCommandValidator.validateAmount(options.amount);
      }
    });
}
