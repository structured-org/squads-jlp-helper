import { Logger } from 'pino';
import { JupiterHelperApp, JupiterPerpsApp } from '@config/config';
import { Coin } from '@lib/coin';
import { bignumber } from 'mathjs';
import { JLP_DENOM, JLP_PRECISION } from '@lib/jlp';

export class JupiterHelperCommandValidator {
  logger: Logger;
  jupiterHelperApp: JupiterHelperApp;

  constructor(logger: Logger, jupiterHelperApp: JupiterHelperApp) {
    this.logger = logger;
    this.jupiterHelperApp = jupiterHelperApp;
  }

  validateAmount(inputAsset: string): Coin {
    const tokens = inputAsset.match(/^(\d+(?:\.\d+)?)([A-Z]+)$/);
    if (tokens.length === 0) {
      throw new Error(`--amount: Invalid format provided -- ${inputAsset}`);
    }

    const [, amount, denom] = tokens;
    if (denom === JLP_DENOM) {
      this.logger.error(
        `--amount: Amount should not have a JLP denom -- ${denom}`,
      );
      process.exit(-1);
    }
    if (
      Object.keys(this.jupiterHelperApp.mints).find((key) => key === denom) ===
      undefined
    ) {
      this.logger.error(
        `--amount: No such a mint described in the config -- ${denom}`,
      );
      process.exit(-1);
    }
    return {
      denom: denom,
      amount: bignumber(amount),
    };
  }

  validateAssetOut(denomOut: string) {
    const tokens = denomOut.match(/^([A-Z]+)$/);
    if (tokens.length === 0) {
      throw new Error(`--assetOut: Invalid format provided -- ${denomOut}`);
    }
    const [, denom] = tokens;
    if (denom === JLP_DENOM) {
      this.logger.error(
        `--assetOut: Amount should not have a JLP denom -- ${denom}`,
      );
      process.exit(-1);
    }
    if (
      Object.keys(this.jupiterHelperApp.mints).find((key) => key === denom) ===
      undefined
    ) {
      this.logger.error(
        `--assetOut: No such a mint described in the config -- ${denom}`,
      );
      process.exit(-1);
    }
  }

  validateJlpAmount(inputAsset: string): Coin {
    const tokens = inputAsset.match(/^(\d+(?:\.\d+)?)([A-Z]+)$/);
    if (tokens.length === 0) {
      throw new Error(`--lpTokenIn: Invalid format provided -- ${inputAsset}`);
    }

    const [, amount, denom] = tokens;
    if (denom !== JLP_DENOM) {
      this.logger.error(
        `--lpTokenIn: Amount should have a JLP denom -- ${denom}`,
      );
      process.exit(-1);
    }
    return {
      denom: denom,
      amount: bignumber(amount),
      precision: JLP_PRECISION,
    };
  }
}

export class JupiterPerpetualsCommandValidator {
  logger: Logger;
  jupiterPerpsApp: JupiterPerpsApp;

  constructor(logger: Logger, jupiterPerpsApp: JupiterPerpsApp) {
    this.logger = logger;
    this.jupiterPerpsApp = jupiterPerpsApp;
  }

  validateAmount(inputAsset: string): Coin {
    const tokens = inputAsset.match(/^(\d+(?:\.\d+)?)([A-Z]+)$/);
    if (tokens.length === 0) {
      throw new Error(`--amount: Invalid format provided -- ${inputAsset}`);
    }

    const [, amount, denom] = tokens;
    if (this.jupiterPerpsApp.coins.get(denom) === undefined) {
      this.logger.error(
        `--amount: No such a coin described in the config -- ${denom}`,
      );
      process.exit(-1);
    }
    return {
      denom: denom,
      amount: bignumber(amount),
      precision: this.jupiterPerpsApp.coins.get(denom)!.decimals,
    };
  }

  validateJlpAmount(inputAsset: string, denomOut: string): Coin {
    const tokens = inputAsset.match(/^(\d+(?:\.\d+)?)([A-Z]+)$/);
    if (tokens.length === 0) {
      throw new Error(`--amount: Invalid format provided -- ${inputAsset}`);
    }

    const [, amount, denom] = tokens;
    if (denom !== JLP_DENOM) {
      this.logger.error(`--amount: Amount should have a JLP denom -- ${denom}`);
      process.exit(-1);
    }
    if (this.jupiterPerpsApp.coins.get(denomOut) === undefined) {
      this.logger.error(
        `--denom-out: Given denom doesn't exist for the given config -- ${denomOut}`,
      );
      process.exit(-1);
    }
    return {
      denom: denom,
      amount: bignumber(amount),
      precision: JLP_PRECISION,
    };
  }
}
