// DCF engine — a line-by-line copy of Arush's Excel model.
// All money values are in USD millions (same as the spreadsheet).
//
// model   = one company from /data/models.json
// live    = { marketCap, shares, beta, riskFree }  (live numbers, or the ones saved in the Excel file)
// changes = what the user moved in the sandbox (all optional):
//   growth, ebitMargin, capexPct  → added to every forecast year (e.g. 0.02 = +2 percentage points)
//   tax, terminalGrowth           → replace the value outright
//   wacc                          → replace the calculated WACC outright

export function waccParts(model, live, tax) {
  const { debt } = model.balance;
  const { erp, creditSpread } = model.rates;
  const equity = live.marketCap;
  const weightDebt = debt / (debt + equity);
  const weightEquity = equity / (debt + equity);
  const costEquity = live.riskFree + live.beta * erp;           // CAPM
  const preTaxDebt = live.riskFree + creditSpread;
  const afterTaxDebt = preTaxDebt * (1 - tax);
  const wacc = weightEquity * costEquity + weightDebt * afterTaxDebt;
  return { weightDebt, weightEquity, costEquity, preTaxDebt, afterTaxDebt, wacc };
}

export function runDcf(model, live, changes = {}) {
  const d = model.drivers;
  const n = d.growth.length;
  const tax = (i) => (changes.tax ?? d.tax[i]);

  const parts = waccParts(model, live, tax(0));
  const wacc = changes.wacc ?? parts.wacc;
  const terminalGrowth = changes.terminalGrowth ?? model.rates.terminalGrowth;

  const years = [];
  let revenue = model.historical.revenue.at(-1);
  let npv = 0;
  for (let i = 0; i < n; i++) {
    const growth = d.growth[i] + (changes.growth ?? 0);
    const margin = d.ebitMargin[i] + (changes.ebitMargin ?? 0);
    const capexPct = Math.max(0, d.capexPct[i] + (changes.capexPct ?? 0));
    revenue = revenue * (1 + growth);
    const ebit = revenue * margin;
    const nopat = ebit * (1 - tax(i));
    const da = d.daPct[i] * revenue;
    const capex = capexPct * revenue;
    const nwc = d.nwc[i];
    const ufcf = nopat + da - capex - nwc;
    const pv = ufcf / (1 + wacc) ** (i + 1);
    npv += pv;
    years.push({ year: model.forecastYears[i], growth, revenue, ebit, nopat, da, capex, nwc, ufcf, pv });
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
