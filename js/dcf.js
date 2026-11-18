// DCF engine — a line-by-line copy of Arush's Excel model.
// All money values are in USD millions (same as the spreadsheet).
//
// model   = one company from /data/models.json
// live    = { marketCap, shares, beta, riskFree }  (live numbers, or the ones saved in the Excel file)
// changes = what the user changed in the sandbox (all optional):
//   drivers        → { growth, ebitMargin, daPct, capexPct, nwc, tax }: any of these 10-year arrays
//                    replaces the one in Arush's model
//   erp            → equity risk premium
//   wacc           → use this WACC instead of calculating it
//   terminalGrowth → perpetual growth rate

export function waccParts(model, live, tax, erp = model.rates.erp) {
  const { debt } = model.balance;
  const { creditSpread } = model.rates;
  const equity = live.marketCap;
  const weightDebt = debt / (debt + equity);
  const weightEquity = equity / (debt + equity);
  const costEquity = live.riskFree + live.beta * erp;           // CAPM
  const preTaxDebt = live.riskFree + creditSpread;
  const afterTaxDebt = preTaxDebt * (1 - tax);
  const wacc = weightEquity * costEquity + weightDebt * afterTaxDebt;
  return { weightDebt, weightEquity, costEquity, preTaxDebt, afterTaxDebt, wacc, erp };
}

export function runDcf(model, live, changes = {}) {
  const d = { ...model.drivers, ...(changes.drivers || {}) };
  const n = d.growth.length;

  const parts = waccParts(model, live, d.tax[0], changes.erp ?? model.rates.erp);
  const wacc = changes.wacc ?? parts.wacc;
  const terminalGrowth = changes.terminalGrowth ?? model.rates.terminalGrowth;

  const years = [];
  let revenue = model.historical.revenue.at(-1);
  let npv = 0;
  for (let i = 0; i < n; i++) {
    revenue = revenue * (1 + d.growth[i]);
    const ebit = revenue * d.ebitMargin[i];
    const nopat = ebit * (1 - d.tax[i]);
    const da = d.daPct[i] * revenue;
    const capex = d.capexPct[i] * revenue;
    const nwc = d.nwc[i];
    const ufcf = nopat + da - capex - nwc;
    const pv = ufcf / (1 + wacc) ** (i + 1);
    npv += pv;
    years.push({ year: model.forecastYears[i], growth: d.growth[i], revenue, ebit, nopat, da, capex, nwc, ufcf, pv });
  }

  const last = years.at(-1).ufcf;
  const valid = wacc > terminalGrowth;
  const terminalValue = valid ? (last * (1 + terminalGrowth)) / (wacc - terminalGrowth) : NaN;
  const pvTerminal = terminalValue / (1 + wacc) ** n;
  const enterpriseValue = npv + pvTerminal;
  const equityValue = enterpriseValue - model.balance.debt + model.balance.cash;
  const sharePrice = equityValue / live.shares;

  return {
    valid, wacc, terminalGrowth, parts, years, npv, terminalValue, pvTerminal,
    enterpriseValue, equityValue, sharePrice,
    terminalShare: pvTerminal / enterpriseValue,
  };
}

// Sensitivity table: share price for every WACC × terminal growth combination.
// Rows step WACC by ±waccStep around the centre, columns step terminal growth by ±tgStep.
export function sensitivity(model, live, changes = {}, { size = 2, waccStep = 0.005, tgStep = 0.0025 } = {}) {
  const centre = runDcf(model, live, changes);
  const offsets = Array.from({ length: size * 2 + 1 }, (_, i) => i - size);
  const waccs = offsets.map((k) => centre.wacc + k * waccStep);
  const tgs = offsets.map((k) => centre.terminalGrowth + k * tgStep);
  const grid = waccs.map((w) => tgs.map((g) => {
    const r = runDcf(model, live, { ...changes, wacc: w, terminalGrowth: g });
    return r.valid ? r.sharePrice : null;
  }));
  return { waccs, tgs, grid, centre: size };
}

// Arush's schedules are straight lines: year-1 value, then a fixed change each year.
export const line = (start, step, n = 10) => Array.from({ length: n }, (_, i) => start + i * step);
