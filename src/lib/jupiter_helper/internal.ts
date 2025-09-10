import { BN } from '@coral-xyz/anchor';

export type PriceCalcMode = 'Min' | 'Max';

export const divCeil = (a: BN, b: BN) => {
  const dm = a.divmod(b);
  // Fast case - exact division
  if (dm.mod.isZero()) return dm.div;
  // Round up
  return dm.div.ltn(0) ? dm.div.isubn(1) : dm.div.iaddn(1);
};

/* Constants */

export const USDC_DECIMALS = 6;
export const RATE_DECIMALS = 9;
export const RATE_POWER = new BN(10).pow(new BN(RATE_DECIMALS));
export const DEBT_POWER = RATE_POWER;

/* Math helpers */

export const checkedDecimalMul = (
  coefficient1: BN,
  exponent1: number,
  coefficient2: BN,
  exponent2: number,
  targetExponent: number,
) => {
  if (coefficient1.eqn(0) || coefficient2.eqn(0)) return new BN(0);

  const targetPower = exponent1 + exponent2 - targetExponent;

  if (targetPower >= 0) {
    return coefficient1
      .mul(coefficient2)
      .mul(new BN(Math.pow(10, targetPower)));
  } else {
    return coefficient1
      .mul(coefficient2)
      .div(new BN(Math.pow(10, -targetPower)));
  }
};

// Formats the oracle price to a target exponent
export function getPrice(oraclePrice: any, targetExponent: number): BN {
  if (targetExponent === oraclePrice.exponent) {
    return oraclePrice.price;
  }

  const delta = targetExponent - oraclePrice.exponent;

  if (delta > 0) {
    return oraclePrice.price.div(new BN(10).pow(new BN(delta)));
  } else {
    return oraclePrice.price.mul(new BN(10).pow(new BN(Math.abs(delta))));
  }
}

// The contract uses this as a safety mechanism for stablecoin depegs
export function getOraclePriceForStable(oraclePrice: any, mode: PriceCalcMode) {
  const oneUsd = new BN(10).pow(new BN(Math.abs(oraclePrice.exponent)));
  const maxPrice =
    mode === 'Max'
      ? BN.max(oneUsd, oraclePrice.price)
      : BN.min(oneUsd, oraclePrice.price);

  return {
    price: maxPrice,
    exponent: oraclePrice.exponent,
  };
}

// Returns the USD value (scaled to the USDC decimals) given an oracle price and token amount
export const getAssetAmountUsd = (
  oracle: any,
  tokenAmount: BN,
  tokenDecimals: number,
): BN => {
  if (tokenAmount.eqn(0) || oracle.price.eqn(0)) {
    return new BN(0);
  }

  return checkedDecimalMul(
    tokenAmount,
    -tokenDecimals,
    oracle.price,
    oracle.exponent,
    -USDC_DECIMALS,
  );
};

/* State helpers */

// Returns the amount borrowed from the custody minus interests accrued (i.e. the pure debt)
export function getDebt(custody: any) {
  return divCeil(
    BN.max(custody.debt.sub(custody.borrowLendInterestsAccured), new BN(0)),
    DEBT_POWER,
  );
}

// Returns the "true" owned token amount by the custody as the borrowed tokens are not stored in `custody.owned`
export function theoreticallyOwned(custody: any) {
  return custody.assets.owned.add(getDebt(custody));
}

// Returns the "true" locked token amount by the custody as the borrowed tokens are not stored in `custody.locked`
export function totalLocked(custody: any) {
  return custody.assets.locked.add(getDebt(custody));
}

export function getGlobalShortPnl(custody: any, price: BN) {
  const averagePrice = custody.assets.globalShortAveragePrices;
  const priceDelta = averagePrice.sub(price).abs();
  const tradersPnlDelta = custody.assets.globalShortSizes
    .mul(priceDelta)
    .div(averagePrice);

  // if true, pool lost, trader profit
  // if false, pool profit, trader lost
  const tradersHasProfit = averagePrice.gt(price);

  return {
    tradersPnlDelta,
    tradersHasProfit,
  };
}

/* Main */

// Returns the assets under management for a given custody in the pool
export function getAssetUnderManagementUsdForCustody(
  custody: any,
  custodyPrice: any,
  mode: PriceCalcMode,
) {
  custodyPrice.price =
    mode === 'Max'
      ? new BN(Math.ceil(custodyPrice.price.toNumber()))
      : new BN(Math.floor(custodyPrice.price.toNumber()));
  const owned = theoreticallyOwned(custody);

  if (custody.isStable) {
    const aumUsd = getAssetAmountUsd(
      getOraclePriceForStable(custodyPrice as any, mode),
      owned,
      custody.decimals,
    );

    return aumUsd;
  } else {
    let tradersPnlDelta = new BN(0);
    let tradersHasProfit = false;
    let aumUsd = custody.assets.guaranteedUsd;

    const netAssetsToken = BN.max(new BN(0), owned.sub(custody.assets.locked));
    const netAssetsUsd = getAssetAmountUsd(
      custodyPrice,
      netAssetsToken,
      custody.decimals,
    );
    aumUsd = aumUsd.add(netAssetsUsd);

    if (custody.assets.globalShortSizes.gtn(0)) {
      ({ tradersPnlDelta, tradersHasProfit } = getGlobalShortPnl(
        custody,
        getPrice(custodyPrice, -USDC_DECIMALS),
      ));

      if (tradersHasProfit) {
        aumUsd = BN.max(new BN(0), aumUsd.sub(tradersPnlDelta));
      } else {
        aumUsd = aumUsd.add(tradersPnlDelta);
      }
    }

    return aumUsd;
  }
}
