import { web3 } from '@project-serum/anchor';
import { Logger } from 'pino';
import { simulateAndBroadcast } from '@lib/helpers';
import { BaseApp } from '@config/config';

type HasAlt = { altAccounts: Array<web3.PublicKey>; altTable?: web3.PublicKey };

export class Alt {
  constructor(
    private readonly logger: Logger,
    private readonly baseApp: BaseApp,
  ) {}

  private async createAltIx(
    keypair: web3.Keypair,
  ): Promise<[web3.TransactionInstruction, web3.PublicKey]> {
    return web3.AddressLookupTableProgram.createLookupTable({
      authority: keypair.publicKey,
      payer: keypair.publicKey,
      recentSlot: (
        await this.baseApp.anchorProvider.connection.getBlocks(
          (await this.baseApp.anchorProvider.connection.getSlot()) - 100,
          undefined,
          'confirmed',
        )
      )[0],
    });
  }

  private extendIxsList(
    keypair: web3.Keypair,
    altAddress: web3.PublicKey,
    accounts: Array<web3.PublicKey>,
  ): Array<web3.TransactionInstruction> {
    const extendIxs: Array<web3.TransactionInstruction> = [];
    for (let i = 0; i < accounts.length; i += 16) {
      extendIxs.push(
        web3.AddressLookupTableProgram.extendLookupTable({
          payer: keypair.publicKey,
          authority: keypair.publicKey,
          lookupTable: altAddress,
          addresses: accounts.slice(i, i + 16),
        }),
      );
    }
    return extendIxs;
  }

  private async createTable(
    keypair: web3.Keypair,
    altAccounts: Array<web3.PublicKey>,
  ): Promise<{
    createIx: web3.TransactionInstruction;
    extendIxs: Array<web3.TransactionInstruction>;
    lookupTableAddress: web3.PublicKey;
  }> {
    const [createIx, lookupTableAddress] = await this.createAltIx(keypair);

    this.logger.info(`ALT address -- ${lookupTableAddress}`);
    for (let i = 1; i <= altAccounts.length; i += 1) {
      this.logger.info(
        `ALT account ${i}/${altAccounts.length} -- ${altAccounts[i - 1]}`,
      );
    }

    const extendIxs = this.extendIxsList(
      keypair,
      lookupTableAddress,
      altAccounts,
    );
    return {
      createIx: createIx,
      extendIxs: extendIxs,
      lookupTableAddress: lookupTableAddress,
    };
  }

  private async createAndFillAlt<T extends HasAlt>(
    keypair: web3.Keypair,
    instance: T,
    ty: string,
  ): Promise<web3.PublicKey> {
    const createTable = await this.createTable(keypair, instance.altAccounts);
    await simulateAndBroadcast(
      this.baseApp.anchorProvider,
      new web3.Transaction().add(
        createTable.createIx,
        createTable.extendIxs.pop(),
      ),
      `${ty} ALT Creation`,
      this.logger,
      keypair,
    );
    for (const [i, extendIx] of createTable.extendIxs.entries()) {
      await simulateAndBroadcast(
        this.baseApp.anchorProvider,
        new web3.Transaction().add(extendIx),
        `${ty} ALT Extension (${i + 1}/${createTable.extendIxs.length})`,
        this.logger,
        keypair,
      );
    }
    return createTable.lookupTableAddress;
  }

  async createAndFillAltIfNecessary<T extends HasAlt>(
    instance: T,
    ty: string,
  ): Promise<web3.PublicKey> {
    if (instance.altTable === undefined) {
      return await this.createAndFillAlt(this.baseApp.keypair, instance, ty);
    } else {
      const lookupTableAccount = (
        await this.baseApp.anchorProvider.connection.getAddressLookupTable(
          new web3.PublicKey(instance.altTable),
        )
      ).value;
      let expectedAccounts = [...instance.altAccounts];
      this.logger.info(`${ty} ALT Table Defined -- ${instance.altTable}`);

      for (let i = 1; i <= lookupTableAccount.state.addresses.length; i += 1) {
        const lookupAddress = lookupTableAccount.state.addresses[i - 1];
        this.logger.info(
          `ALT Account ${i}/${lookupTableAccount.state.addresses.length} -- ${lookupAddress}`,
        );
        expectedAccounts = expectedAccounts.filter(
          (account) => account.toBase58() !== lookupAddress.toBase58(),
        );
      }
      if (expectedAccounts.length !== 0) {
        for (const remainingAccount of expectedAccounts) {
          this.logger.warn(`${ty} ALT missing -- ${remainingAccount}`);
        }
        this.logger.info(`${ty} Creating a new ALT`); // Don't modify the existing ALT
        const newAlt = await this.createAndFillAlt(
          this.baseApp.keypair,
          instance,
          ty,
        );
        this.logger.info(`${ty} Using new ALT -- ${newAlt}`);
        return newAlt;
      } else {
        return instance.altTable;
      }
    }
  }
}

export { createJupiterPerpsAltTableIfNotExist } from './jupiter_perps';
export { createWormholeAltTablesIfNotExist } from './wormhole';
