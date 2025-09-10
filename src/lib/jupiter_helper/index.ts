import { Logger } from 'pino';
import { BaseApp, JupiterHelperApp } from '@config/config';

export class JupiterHelper {
  constructor(
    private logger: Logger,
    private baseApp: BaseApp,
    private jupiterHelperApp: JupiterHelperApp,
  ) {}

  get app(): JupiterHelperApp {
    return this.jupiterHelperApp;
  }
}
