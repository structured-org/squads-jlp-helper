import { Logger } from 'pino';
import { BaseApp, JupiterHelperApp } from '@config/config';
import { web3 } from '@project-serum/anchor';

export class JupiterHelper {
  constructor(
    private logger: Logger,
    private baseApp: BaseApp,
    private jupiterHelperApp: JupiterHelperApp,
  ) {}

  get app(): JupiterHelperApp {
    return this.jupiterHelperApp;
  }

  // async processIx(
  //   lpAmountIn: string,
  //   denomOut: string,
  // ): Promise<web3.TransactionInstruction> {}
}
