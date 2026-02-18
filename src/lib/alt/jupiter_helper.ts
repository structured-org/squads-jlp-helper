import { type JupiterHelperApp } from '@config/config';
import { type Alt } from '.';

export async function createJupiterHelperAltTableIfNotExist(
  alt: Alt,
  jupiterHelperApp: JupiterHelperApp,
) {
  const ty = 'Jupiter Helper';
  await alt.createAndFillAltIfNecessary(jupiterHelperApp, ty);
}
