import { Alt, createJupiterHelperAltTableIfNotExist } from '@lib/alt';
import { Command } from 'commander';
import { Logger } from 'pino';
import { BaseApp } from '@config/config';
import { JupiterHelper } from '@lib/jupiter_helper';
import { web3 } from '@project-serum/anchor';
import {
  compileTransactionMessageWithAlt,
  simulateAndBroadcast,
  simulateAndBroadcastVersionedTx,
} from '@lib/helpers';
import { ComputeBudgetProgram } from '@solana/web3.js';
import { SquadsMultisig } from '@lib/squads';

export function registerJupiterHelperProcessOptimalWithdrawsCommand(
  alt: Alt,
  program: Command,
  logger: Logger,
  baseApp: BaseApp,
  jupiterHelper: JupiterHelper,
) {
  program
    .command('jupiter-helper-process-optimal-withdraws')
    .description('Call process method on the Jupiter Helper')
    .requiredOption(
      '--assetOut <assetOut>',
      'Denom of the token that we expect to get back',
    )
    .requiredOption(
      '--amountToProcess <amountToProcess>',
      'Denom of the token that we expect to get back',
    )
    .requiredOption(
      '--safetyMargin <safetyMargin>',
      'Denom of the token that we expect to get back',
    )
    .action(async (options) => {
      await createJupiterHelperAltTableIfNotExist(alt, jupiterHelper.app);
      const optimalAmounts = await jupiterHelper.getOptimalAmounts(
        options.safetyMargin,
        options.amountToProcess,
        options.assetOut,
      );
      logger.info(`optimal amounts -- ${optimalAmounts}`);
      logger.info(`optimal amounts length -- ${optimalAmounts.length}`);

      if (optimalAmounts.length > 5) {
        logger.error(`optimalAmounts length shouldn't be greater than 5`);
        process.exit(-1);
      }

      const processIxs: Array<web3.TransactionInstruction> = [];
      for (const optimalAmount of optimalAmounts) {
        const processIx = await jupiterHelper.processIx(
          optimalAmount,
          options.assetOut,
          'withdrawer',
        );
        processIxs.push(processIx);
      }
      const messageV0 = await compileTransactionMessageWithAlt(
        baseApp.anchorProvider,
        [
          ComputeBudgetProgram.setComputeUnitLimit({
            units: 1_400_000,
          }),
          ...processIxs,
        ],
        baseApp.keypair.publicKey,
        jupiterHelper.app.altTable,
      );
      const tx = new web3.VersionedTransaction(messageV0);
      logger.info(`tx length -- ${tx.serialize().length}`);

      tx.sign([baseApp.keypair]);
      const txhash = await simulateAndBroadcastVersionedTx(
        baseApp.anchorProvider,
        tx,
        'jupiter helper process',
        logger,
      );
      logger.info(`txhash -- ${txhash}`);
      logger.info(
        `feeBpsEach -- ${await jupiterHelper.getFeeBpsEach('65YKEZtpbGZUvmVTfrFmSgrM6x65yVP7rUibKFkx9ijdSajaDPUXD6UfSwCe47WDmkSybGYTcphCwPRARjx1XQKb', 2)}`,
      );
    });
}

export function registerHelperWithdrawAssetCommand(
  alt: Alt,
  program: Command,
  logger: Logger,
  baseApp: BaseApp,
  jupiterHelper: JupiterHelper,
  squadsMultisig: SquadsMultisig,
) {
  program
    .command('jupiter-helper-withdraw-asset')
    .requiredOption(
      '--proposal-index <proposal-index>',
      'Index of the proposal',
    )
    .requiredOption(
      '--instance-mint <instance-mint>',
      'Mint for the instance of Jupiter Helper',
    )
    .requiredOption(
      '--instance-type <type>',
      'Type of the instance: withdrawer | provider',
    )
    .requiredOption(
      '--recipient-ata <recipient-ata>',
      'ATA from the recipient SOL and Mint SPL',
    )
    .requiredOption('--withdraw-mint <withdraw-mint>', 'SPL to withdraw')
    .option(
      '--amount',
      'Amount to withdraw. If not provided, all available amount will be withdrawn',
    )
    .description('withdraw asset')
    .action(async (options) => {
      await createJupiterHelperAltTableIfNotExist(alt, jupiterHelper.app);
      const batch = await squadsMultisig.getBatch(options.proposalIndex!);

      logger.info(`Batch Transaction Index -- ${batch.size + 1}`);
      const withdrawAssetIx = await jupiterHelper.withdrawAssetIx(
        jupiterHelper.app.jhAccounts.get(options.instanceMint!)[
          options.instanceType
        ],
        options.recipientAta,
        options.withdrawMint,
        options.amount ? options.amount : null,
      );
      const altData = (
        await baseApp.anchorProvider.connection.getAddressLookupTable(
          new web3.PublicKey(jupiterHelper.app.altTable!),
        )
      ).value;
      const batchAddIx = await squadsMultisig.batchAddByIndexIxV0(
        options.proposalIndex!,
        batch.size + 1,
        withdrawAssetIx,
        altData,
      );
      const tx = new web3.Transaction().add(batchAddIx);
      await simulateAndBroadcast(
        baseApp.anchorProvider,
        tx,
        'withdraw asset',
        logger,
        baseApp.keypair,
      );
    });
}
