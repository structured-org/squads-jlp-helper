import { web3, AnchorProvider } from '@project-serum/anchor';
import { parse } from 'yaml';
import fs from 'fs';

type ConfigFile = {
  squads_multisig: {
    program_idl: string;
    multisig_address: string;
    vault_pda: string;
  };
  jupiter_helper: {
    program: string;
    jh_accounts: Array<{
      coin: string;
      mode: 'withdrawer' | 'provider';
      config: string;
      vault: string;
      ownership: string;
    }>;
    mints: {
      JLP: string;
      USDC: string;
      USDT: string;
      WETH: string;
      WSOL: string;
      WBTC: string;
    };
    jp_accounts: {
      lp_token_mint: string;
      transfer_authority: string;
      perpetuals: string;
      pool: string;
      event_authority: string;
      program: string;
      dependent_accounts: Array<{
        coin: string;
        custody: string;
        custody_doves_price_account: string;
        custody_pythnet_price_account: string;
        custody_token_account: string;
      }>;
      remaining_accounts: Array<string>;
    };
    alt_accounts: Array<string>;
  };
  wormhole: {
    coins: Array<{
      coin: string;
      decimals: number;
      token_address: string;
    }>;
    chains: Array<{
      name: string;
      alt_table?: string;
      token_bridge_relayer: string;
      token_bridge: string;
      core_bridge: string;
      alt_accounts: Array<string>;
      remaining_accounts: Array<string>;
    }>;
  };
  jupiter_perps: {
    program_idl: string;
    program: string;
    alt_table?: string;
    pool: string;
    perpetuals: string;
    lp_token_mint: {
      decimals: number;
      coin: string;
      token_address: string;
    };
    remaining_accounts: Array<string>;
    alt_accounts: Array<string>;
    coins: Array<{
      coin: 'WSOL' | 'USDC' | 'WETH' | 'USDT' | 'WBTC';
      decimals: number;
      token_address: string;
      input_accounts: {
        transfer_authority: string;
        perpetuals: string;
        pool: string;
        custody: string;
        custody_doves_price_account: string;
        custody_pythnet_price_account: string;
        custody_token_account: string;
        lp_token_mint: string;
        token_program: string;
        event_authority: string;
        program: string;
      };
    }>;
  };
};

export type BaseApp = {
  anchorProvider: AnchorProvider;
  keypair: web3.Keypair;
};

export type SquadsMultisigApp = {
  programIdl: any;
  multisigAddress: web3.PublicKey;
  vaultPda: web3.PublicKey;
};

export type JupiterHelperApp = {
  program: web3.PublicKey;
  jhAccounts: Map<
    string,
    {
      mode: 'withdrawer' | 'provider';
      config: web3.PublicKey;
      vault: web3.PublicKey;
      ownership: web3.PublicKey;
    }
  >;
  mints: {
    JLP: web3.PublicKey;
    USDC: web3.PublicKey;
    USDT: web3.PublicKey;
    WETH: web3.PublicKey;
    WSOL: web3.PublicKey;
    WBTC: web3.PublicKey;
  };
  jpAccounts: {
    lpTokenMint: web3.PublicKey;
    transferAuthority: web3.PublicKey;
    perpetuals: web3.PublicKey;
    pool: web3.PublicKey;
    eventAuthority: web3.PublicKey;
    program: web3.PublicKey;
    dependentAccounts: Map<
      string,
      {
        custody: web3.PublicKey;
        custodyDovesPriceAccount: web3.PublicKey;
        custodyPythnetPriceAccount: web3.PublicKey;
        custodyTokenAccount: web3.PublicKey;
      }
    >;
    remainingAccounts: Array<web3.PublicKey>;
  };
  altAccounts: Array<web3.PublicKey>;
};

export type WormholeChain = {
  altTable?: web3.PublicKey;
  tokenBridgeRelayer: web3.PublicKey;
  tokenBridge: web3.PublicKey;
  coreBridge: web3.PublicKey;
  altAccounts: Array<web3.PublicKey>;
  remainingAccounts: Array<web3.PublicKey>;
};

export type WormholeToken = {
  token_address: web3.PublicKey;
  decimals: number;
};

export type WormholeApp = {
  coins: Map<string, WormholeToken>;
  chains: Map<string, WormholeChain>;
};

type JupiterPerpsInputAccounts = {
  transfer_authority: web3.PublicKey;
  perpetuals: web3.PublicKey;
  pool: web3.PublicKey;
  custody: web3.PublicKey;
  custody_doves_price_account: web3.PublicKey;
  custody_pythnet_price_account: web3.PublicKey;
  custody_token_account: web3.PublicKey;
  lp_token_mint: web3.PublicKey;
  token_program: web3.PublicKey;
  event_authority: web3.PublicKey;
  program: web3.PublicKey;
};

export type JupiterPerpsToken = {
  decimals: number;
  token_address: web3.PublicKey;
  input_accounts: JupiterPerpsInputAccounts;
};

export type JupiterPerpsApp = {
  programIdl: any;
  pool: web3.PublicKey;
  lpTokenMint: {
    decimals: number;
    coin: string;
    tokenAddress: web3.PublicKey;
  };
  perpetuals: web3.PublicKey;
  program: web3.PublicKey;
  altTable?: web3.PublicKey;
  remainingAccounts: Array<web3.PublicKey>;
  altAccounts: Array<web3.PublicKey>;
  coins: Map<string, JupiterPerpsToken>;
};

export function parseConfig(configPath: string): ConfigFile {
  const content = fs.readFileSync(configPath).toString();
  return parse(content);
}

export function getBaseApp(): BaseApp {
  const keypair = web3.Keypair.fromSecretKey(
    Buffer.from(
      JSON.parse(
        fs.readFileSync(process.env.ANCHOR_WALLET, {
          encoding: 'utf-8',
        }),
      ),
    ),
  );
  const provider = AnchorProvider.local(process.env.ANCHOR_PROVIDER_URL, {
    commitment: 'confirmed',
    skipPreflight: true,
  });
  return {
    keypair: keypair,
    anchorProvider: provider,
  };
}

export function getSquadsMultisigAppFromConfig(
  config: ConfigFile,
): SquadsMultisigApp {
  return {
    programIdl: JSON.parse(
      require('fs').readFileSync('./idl/squads_multisig.json', {
        encoding: 'utf-8',
      }),
    ),
    multisigAddress: new web3.PublicKey(
      config.squads_multisig.multisig_address,
    ),
    vaultPda: new web3.PublicKey(config.squads_multisig.vault_pda),
  };
}

export function getJupiterHelperAppFromConfig(
  config: ConfigFile,
): JupiterHelperApp {
  return {
    program: new web3.PublicKey(config.jupiter_helper.program),
    mints: {
      JLP: new web3.PublicKey(config.jupiter_helper.mints.JLP),
      USDC: new web3.PublicKey(config.jupiter_helper.mints.USDC),
      USDT: new web3.PublicKey(config.jupiter_helper.mints.USDT),
      WBTC: new web3.PublicKey(config.jupiter_helper.mints.WBTC),
      WETH: new web3.PublicKey(config.jupiter_helper.mints.WETH),
      WSOL: new web3.PublicKey(config.jupiter_helper.mints.WSOL),
    },
    jhAccounts: new Map(
      config.jupiter_helper.jh_accounts.map((asset) => [
        asset.coin,
        {
          mode: asset.mode,
          config: new web3.PublicKey(asset.config),
          vault: new web3.PublicKey(asset.vault),
          ownership: new web3.PublicKey(asset.ownership),
        },
      ]),
    ),
    jpAccounts: {
      lpTokenMint: new web3.PublicKey(
        config.jupiter_helper.jp_accounts.lp_token_mint,
      ),
      transferAuthority: new web3.PublicKey(
        config.jupiter_helper.jp_accounts.transfer_authority,
      ),
      perpetuals: new web3.PublicKey(
        config.jupiter_helper.jp_accounts.perpetuals,
      ),
      pool: new web3.PublicKey(config.jupiter_helper.jp_accounts.pool),
      eventAuthority: new web3.PublicKey(
        config.jupiter_helper.jp_accounts.event_authority,
      ),
      program: new web3.PublicKey(config.jupiter_helper.jp_accounts.program),
      dependentAccounts: new Map(
        config.jupiter_helper.jp_accounts.dependent_accounts.map((accounts) => [
          accounts.coin,
          {
            custody: new web3.PublicKey(accounts.custody),
            custodyDovesPriceAccount: new web3.PublicKey(
              accounts.custody_doves_price_account,
            ),
            custodyPythnetPriceAccount: new web3.PublicKey(
              accounts.custody_pythnet_price_account,
            ),
            custodyTokenAccount: new web3.PublicKey(
              accounts.custody_token_account,
            ),
          },
        ]),
      ),
      remainingAccounts:
        config.jupiter_helper.jp_accounts.remaining_accounts.map(
          (account) => new web3.PublicKey(account),
        ),
    },
    altAccounts: config.jupiter_helper.alt_accounts.map(
      (account) => new web3.PublicKey(account),
    ),
  };
}

export function getWormholeAppfromConfig(config: ConfigFile): WormholeApp {
  return {
    coins: new Map(
      config.wormhole.coins.map((coin) => [
        coin.coin,
        {
          token_address: new web3.PublicKey(coin.token_address),
          decimals: coin.decimals,
        },
      ]),
    ),
    chains: new Map(
      config.wormhole.chains.map((chain) => {
        const chainConfiguraion: WormholeChain = {
          altTable: chain.alt_table
            ? new web3.PublicKey(chain.alt_table)
            : undefined,
          tokenBridgeRelayer: new web3.PublicKey(chain.token_bridge_relayer),
          tokenBridge: new web3.PublicKey(chain.token_bridge),
          coreBridge: new web3.PublicKey(chain.core_bridge),
          remainingAccounts: chain.remaining_accounts.map(
            (account) => new web3.PublicKey(account),
          ),
          altAccounts: chain.alt_accounts.map(
            (account) => new web3.PublicKey(account),
          ),
        };
        return [chain.name, chainConfiguraion];
      }),
    ),
  };
}

export function getJupiterPerpsAppFromConfig(
  config: ConfigFile,
): JupiterPerpsApp {
  return {
    programIdl: JSON.parse(
      require('fs').readFileSync('./idl/perpetuals.json', {
        encoding: 'utf-8',
      }),
    ),
    lpTokenMint: {
      coin: config.jupiter_perps.lp_token_mint.coin,
      decimals: config.jupiter_perps.lp_token_mint.decimals,
      tokenAddress: new web3.PublicKey(
        config.jupiter_perps.lp_token_mint.token_address,
      ),
    },
    pool: new web3.PublicKey(config.jupiter_perps.pool),
    perpetuals: new web3.PublicKey(config.jupiter_perps.perpetuals),
    program: new web3.PublicKey(config.jupiter_perps.program),
    altTable: config.jupiter_perps.alt_table
      ? new web3.PublicKey(config.jupiter_perps.alt_table)
      : undefined,
    remainingAccounts: config.jupiter_perps.remaining_accounts.map(
      (address) => new web3.PublicKey(address),
    ),
    altAccounts: config.jupiter_perps.alt_accounts.map(
      (address) => new web3.PublicKey(address),
    ),
    coins: new Map(
      config.jupiter_perps.coins.map((coin) => {
        const inputAccounts: JupiterPerpsInputAccounts = {
          transfer_authority: new web3.PublicKey(
            coin.input_accounts.transfer_authority,
          ),
          perpetuals: new web3.PublicKey(coin.input_accounts.perpetuals),
          pool: new web3.PublicKey(coin.input_accounts.pool),
          custody: new web3.PublicKey(coin.input_accounts.custody),
          custody_doves_price_account: new web3.PublicKey(
            coin.input_accounts.custody_doves_price_account,
          ),
          custody_pythnet_price_account: new web3.PublicKey(
            coin.input_accounts.custody_pythnet_price_account,
          ),
          custody_token_account: new web3.PublicKey(
            coin.input_accounts.custody_token_account,
          ),
          lp_token_mint: new web3.PublicKey(coin.input_accounts.lp_token_mint),
          token_program: new web3.PublicKey(coin.input_accounts.token_program),
          event_authority: new web3.PublicKey(
            coin.input_accounts.event_authority,
          ),
          program: new web3.PublicKey(coin.input_accounts.program),
        };

        const token: JupiterPerpsToken = {
          decimals: coin.decimals,
          token_address: new web3.PublicKey(coin.token_address),
          input_accounts: inputAccounts,
        };
        return [coin.coin, token];
      }),
    ),
  };
}
