// Macro scenarios: each one is a set of shocks applied on top of the base case.
// Effect kinds:
//   rf     → risk-free rate (changes cost of equity and cost of debt)
//   erp    → equity risk premium
//   growth → revenue growth            (from/to = forecast year index, to is exclusive; default all 10 years)
//   margin → EBIT margin
//   capex  → CapEx as % of revenue
//   tax    → tax rate
//   tg     → terminal growth
// All shocks are in percentage points (0.01 = 1 pp) and are multiplied by the strength (mild 0.5 / normal 1 / severe 2).
import { runDcf, waccParts } from "/js/dcf.js?v=2";

const LABEL = { rf: "Risk-free rate", erp: "Equity risk premium", growth: "Revenue growth", margin: "EBIT margin", capex: "CapEx", tax: "Tax rate", tg: "Terminal growth" };
const DRIVER = { growth: "growth", margin: "ebitMargin", capex: "capexPct", tax: "tax" };

export const STRENGTHS = [
  { key: "mild", label: "Mild", m: 0.5 },
  { key: "normal", label: "Normal", m: 1 },
  { key: "severe", label: "Severe", m: 2 },
];

export const SCENARIOS = [
  { id: "rate-hike", group: "Rates & currency", title: "Interest rate hike", ink: "#ff8a5c",
    blurb: "Central banks raise rates to cool inflation.",
    why: "Higher rates make future cash worth less today, so WACC goes up and value goes down.",
    effects: [{ k: "rf", d: 0.015 }] },
  { id: "rate-cut", group: "Rates & currency", title: "Interest rate cut", ink: "#2fd27a",
    blurb: "Central banks cut rates to support the economy.",
    why: "Cheaper money lowers WACC, and spending picks up a little.",
    effects: [{ k: "rf", d: -0.015 }, { k: "growth", d: 0.01, from: 0, to: 2 }] },
  { id: "soft-landing", group: "Rates & currency", title: "Soft landing", ink: "#7cc4ff",
    blurb: "Inflation falls without a recession.",
    why: "Rates ease, investors relax and growth stays healthy.",
    effects: [{ k: "rf", d: -0.005 }, { k: "erp", d: -0.005 }, { k: "growth", d: 0.02, from: 0, to: 3 }] },

  { id: "strong-dollar", group: "Rates & currency", title: "Strong dollar", ink: "#9ad17a",
    blurb: "The US dollar rises against other currencies.",
    why: "Sales made abroad are worth fewer dollars.",
    effects: [{ k: "growth", d: -0.02, from: 0, to: 2 }, { k: "margin", d: -0.01, from: 0, to: 2 }] },

  { id: "recession", group: "Economy", title: "Recession", ink: "#ff5c5c",
    blurb: "The economy shrinks for two years.",
    why: "Sales and margins fall, and investors demand more return for the risk.",
    effects: [{ k: "growth", d: -0.08, from: 0, to: 2 }, { k: "margin", d: -0.03, from: 0, to: 2 }, { k: "erp", d: 0.01 }] },
  { id: "inflation", group: "Economy", title: "Inflation spike", ink: "#ffb347",
    blurb: "Prices and wages jump for three years.",
    why: "Costs rise faster than prices, building things gets dearer, and rates go up.",
    effects: [{ k: "rf", d: 0.01 }, { k: "margin", d: -0.02, from: 0, to: 3 }, { k: "capex", d: 0.01, from: 0, to: 3 }] },
  { id: "stagflation", group: "Economy", title: "Stagflation", ink: "#ff7a9c",
    blurb: "High inflation and weak growth at the same time.",
    why: "The worst of both: higher rates, slower sales and squeezed margins.",
    effects: [{ k: "rf", d: 0.01 }, { k: "growth", d: -0.04, from: 0, to: 3 }, { k: "margin", d: -0.02, from: 0, to: 3 }] },
  { id: "market-crash", group: "Economy", title: "Market crash", ink: "#ff5c5c",
    blurb: "Investors panic and sell shares.",
    why: "The business is the same, but investors want a bigger reward for owning shares.",
    effects: [{ k: "erp", d: 0.02 }] },
  { id: "tax-rise", group: "Policy", title: "Tax rise", ink: "#ff8a5c",
    blurb: "The government raises the tax on company profits.",
    why: "More of every dollar of profit goes to the government.",
    effects: [{ k: "tax", d: 0.05 }] },
  { id: "tax-cut", group: "Policy", title: "Tax cut", ink: "#2fd27a",
    blurb: "The government cuts the tax on company profits.",
    why: "The company keeps more of its profit.",
    effects: [{ k: "tax", d: -0.04 }] },
  { id: "tariffs", group: "Policy", title: "Trade war", ink: "#ffb347",
    blurb: "Countries put tariffs on each other's goods.",
    why: "Parts cost more and some overseas customers buy less.",
    effects: [{ k: "growth", d: -0.03, from: 0, to: 3 }, { k: "margin", d: -0.02 }] },
  { id: "regulation", group: "Policy", title: "Tough regulation", ink: "#c3a6ff",
    blurb: "Antitrust rules limit how big tech can grow.",
    why: "Slower growth and lower margins for good, and lower long-term growth.",
    effects: [{ k: "growth", d: -0.02 }, { k: "margin", d: -0.03 }, { k: "tg", d: -0.0025 }] },

  { id: "ai-boom", group: "Industry", title: "AI boom", ink: "#2fd27a",
    blurb: "Demand for AI products takes off.",
    why: "Sales and margins jump, but the company spends more on data centres.",
    effects: [{ k: "growth", d: 0.06, from: 0, to: 3 }, { k: "margin", d: 0.02 }, { k: "capex", d: 0.02, from: 0, to: 3 }] },
  { id: "supply-chain", group: "Industry", title: "Supply shock", ink: "#ffb347",
    blurb: "Factories and shipping are disrupted.",
    why: "Fewer products to sell, higher costs, and money spent finding new suppliers.",
    effects: [{ k: "growth", d: -0.03, from: 0, to: 1 }, { k: "margin", d: -0.02, from: 0, to: 2 }, { k: "capex", d: 0.02, from: 0, to: 2 }] },
  { id: "energy", group: "Industry", title: "Energy crisis", ink: "#ffd84d",
    blurb: "Oil, gas and electricity prices soar.",
    why: "Running offices and data centres costs more, and inflation pushes rates up.",
    effects: [{ k: "margin", d: -0.015, from: 0, to: 3 }, { k: "rf", d: 0.005 }] },
  { id: "conflict", group: "Industry", title: "Global conflict", ink: "#ff7a9c",
    blurb: "A major war or crisis between big economies.",
    why: "Markets get nervous, sales slow and companies spend to move production.",
    effects: [{ k: "erp", d: 0.015 }, { k: "growth", d: -0.03, from: 0, to: 2 }, { k: "capex", d: 0.01, from: 0, to: 3 }] },
];

export const GROUPS = [...new Set(SCENARIOS.map((s) => s.group))];
export const byId = (id) => SCENARIOS.find((s) => s.id === id);

// Turn a scenario into inputs for the DCF engine.
// start = where to apply it from: nothing (Arush's base case) or the user's sandbox settings
//         ({ ch, runLive } from sandboxChanges).
export function applyScenario(sc, model, live, m = 1, start = null) {
  const n = model.forecastYears.length;
  const from = start?.ch || {};
  const drivers = { ...(from.drivers || {}) };
  const L = { ...(start?.runLive || live) };
  let erp = from.erp ?? model.rates.erp;
  let terminalGrowth = from.terminalGrowth ?? model.rates.terminalGrowth;
  for (const e of sc.effects) {
    const d = e.d * m;
    if (e.k === "rf") L.riskFree = Math.max(0, L.riskFree + d);
    else if (e.k === "erp") erp = Math.max(0, erp + d);
    else if (e.k === "tg") terminalGrowth = Math.max(0, terminalGrowth + d);
    else {
      const key = DRIVER[e.k];
      const arr = (drivers[key] || model.drivers[key]).slice();
      for (let i = e.from ?? 0; i < (e.to ?? n); i++) {
        arr[i] = e.k === "growth" ? Math.max(-0.9, arr[i] + d) : Math.max(0, arr[i] + d);
      }
      drivers[key] = arr;
    }
  }
  const changes = { drivers, erp, terminalGrowth };
  // If the user typed in their own WACC, rates can't flow through the formula,
  // so move their WACC by however much the scenario moves the calculated one.
  if (from.wacc != null) {
    const tax0 = (from.drivers?.tax || model.drivers.tax)[0];
    const before = waccParts(model, start?.runLive || live, tax0, from.erp ?? model.rates.erp).wacc;
    const after = waccParts(model, L, (drivers.tax || model.drivers.tax)[0], erp).wacc;
    changes.wacc = from.wacc + (after - before);
  }
  return { changes, live: L };
}

export function runScenario(sc, co, m = 1, start = null) {
  const base = start ? runDcf(co.model, start.runLive, start.ch) : runDcf(co.model, co.live);
  const { changes, live } = applyScenario(sc, co.model, co.live, m, start);
  const r = runDcf(co.model, live, changes);
  return { base, r, change: r.valid && base.valid ? r.sharePrice / base.sharePrice - 1 : null };
}

// "Revenue growth −8.0 pp (2026–2027)"
export function describe(e, model, m = 1) {
  const d = e.d * m;
  const yrs = model.forecastYears.map((y) => String(y).replace(/^FY/, ""));
  const from = e.from ?? 0, to = e.to ?? yrs.length;
  const when = from === 0 && to === yrs.length ? "" : to - from === 1 ? ` (${yrs[from]})` : ` (${yrs[from]}–${yrs[to - 1]})`;
  const digits = Math.abs(d * 100) % 1 ? 2 : 1;
  return { label: LABEL[e.k], value: (d >= 0 ? "+" : "−") + Math.abs(d * 100).toFixed(digits) + " pp" + when, bad: isBad(e.k, d) };
}
const isBad = (k, d) => (["rf", "erp", "capex", "tax"].includes(k) ? d > 0 : d < 0);

// ----- Pictures (drawn here, no outside images) -----
const ARROW_UP = (x, c) => `<path d="M${x} 74V30M${x - 9} 40l9-11 9 11" stroke="${c}" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
const ARROW_DOWN = (x, c) => `<path d="M${x} 26v44M${x - 9} 60l9 11 9-11" stroke="${c}" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
const BANK = (c) => `<g fill="${c}"><path d="M30 38 70 18l40 20z" opacity=".95"/><rect x="30" y="39" width="80" height="5" rx="1"/>
  <g opacity=".85"><rect x="36" y="47" width="7" height="27" rx="1"/><rect x="50" y="47" width="7" height="27" rx="1"/><rect x="64" y="47" width="7" height="27" rx="1"/><rect x="78" y="47" width="7" height="27" rx="1"/><rect x="92" y="47" width="7" height="27" rx="1"/></g>
  <rect x="28" y="75" width="84" height="5" rx="1"/><rect x="22" y="81" width="96" height="5" rx="1" opacity=".7"/>
  <circle cx="70" cy="31" r="3.2" fill="#0b0d10"/></g>`;

const SCENES = {
  "rate-hike": (c) => BANK("#e9edf3") + ARROW_UP(136, c) + `<text x="136" y="94" fill="${c}" font-size="13" font-weight="700" text-anchor="middle" font-family="Inter,sans-serif">%</text>`,
  "rate-cut": (c) => BANK("#e9edf3") + ARROW_DOWN(136, c) + `<text x="136" y="20" fill="${c}" font-size="13" font-weight="700" text-anchor="middle" font-family="Inter,sans-serif">%</text>`,
  "soft-landing": (c) => `<circle cx="126" cy="26" r="11" fill="#ffd84d"/><path d="M14 84h132" stroke="#e9edf3" stroke-width="3" stroke-dasharray="10 7" stroke-linecap="round"/>
    <path d="M40 30c25 6 45 22 62 44" stroke="${c}" stroke-width="2" stroke-dasharray="3 5" fill="none"/>
    <g transform="translate(96 66) rotate(28)" fill="#e9edf3"><path d="M-18 -3h30l8 3-8 3h-30z"/><path d="M-4 -3l-8 -12h6l12 12zM-4 3l-8 12h6l12-12z"/><path d="M-18 -3l-5 -7h4l6 7z"/></g>`,
  recession: (c) => `<path d="M16 86h130M16 86V20" stroke="#5a6372" stroke-width="2"/>
    <path d="M22 34l22 10 16-6 22 22 18-4 24 26" stroke="${c}" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M118 30a11 11 0 0 1 21-4 9 9 0 0 1 3 17h-27a7 7 0 0 1 3-13z" fill="#aab3c0"/>
    <path d="M122 50l-3 7M131 50l-3 7M140 50l-3 7" stroke="#7cc4ff" stroke-width="2.5" stroke-linecap="round"/>`,
  inflation: (c) => `<g transform="rotate(-14 70 55)"><path d="M30 38h62l18 17-18 17H30z" fill="#e9edf3"/><circle cx="96" cy="55" r="4" fill="#0b0d10"/>
    <text x="60" y="64" fill="#0b0d10" font-size="24" font-weight="800" text-anchor="middle" font-family="Inter,sans-serif">$$$</text></g>` + ARROW_UP(134, c),
  stagflation: (c) => `<rect x="34" y="16" width="16" height="54" rx="8" fill="#e9edf3"/><circle cx="42" cy="76" r="13" fill="#e9edf3"/>
    <rect x="38.5" y="30" width="7" height="44" rx="3.5" fill="${c}"/><circle cx="42" cy="76" r="9" fill="${c}"/>
    <path d="M74 40h66M74 40v44h66" stroke="#5a6372" stroke-width="2" fill="none"/><path d="M80 52l18 4 16 -2 22 10" stroke="#aab3c0" stroke-width="4" fill="none" stroke-linecap="round"/>`,
  "market-crash": (c) => `<path d="M14 88h132" stroke="#5a6372" stroke-width="2"/>
    ${[[28, 22, 42, 16, 50], [50, 30, 52, 24, 60], [72, 44, 62, 38, 70], [94, 52, 74, 46, 80], [116, 62, 82, 56, 86]].map(([x, y, h2, t, b]) => `<path d="M${x} ${t}V${b}" stroke="${c}" stroke-width="2"/><rect x="${x - 6}" y="${y}" width="12" height="${h2 - y}" rx="1.5" fill="${c}"/>`).join("")}
    <path d="M128 18l-4 18h8l-6 22" stroke="#ffd84d" stroke-width="3" fill="none" stroke-linejoin="round"/>`,
  "strong-dollar": (c) => `<circle cx="64" cy="54" r="32" fill="#e9edf3"/><circle cx="64" cy="54" r="25" fill="none" stroke="#0b0d10" stroke-width="2" opacity=".25"/>
    <text x="64" y="68" fill="#0b0d10" font-size="38" font-weight="800" text-anchor="middle" font-family="Inter,sans-serif">$</text>` + ARROW_UP(126, c),
  "tax-rise": (c) => `<path d="M38 14h46l16 16v60H38z" fill="#e9edf3"/><path d="M84 14v16h16" fill="#c9d0db"/>
    <path d="M48 40h30M48 50h40M48 60h24" stroke="#aab3c0" stroke-width="3" stroke-linecap="round"/>
    <text x="69" y="84" fill="#0b0d10" font-size="18" font-weight="800" text-anchor="middle" font-family="Inter,sans-serif">TAX</text>` + ARROW_UP(130, c),
  "tax-cut": (c) => `<path d="M38 14h46l16 16v60H38z" fill="#e9edf3"/><path d="M84 14v16h16" fill="#c9d0db"/>
    <path d="M48 40h30M48 50h40M48 60h24" stroke="#aab3c0" stroke-width="3" stroke-linecap="round"/>
    <text x="69" y="84" fill="#0b0d10" font-size="18" font-weight="800" text-anchor="middle" font-family="Inter,sans-serif">TAX</text>` + ARROW_DOWN(130, c),
  tariffs: (c) => `${[[24, 52, "#7cc4ff"], [62, 52, "#ffb347"], [43, 26, "#ff7a9c"]].map(([x, y, f]) => `<rect x="${x}" y="${y}" width="36" height="24" rx="2" fill="${f}"/><path d="M${x + 7} ${y + 4}v16M${x + 14} ${y + 4}v16M${x + 21} ${y + 4}v16M${x + 28} ${y + 4}v16" stroke="#0b0d10" stroke-width="1.5" opacity=".35"/>`).join("")}
    <path d="M16 78h90" stroke="#5a6372" stroke-width="2"/>
    <g transform="translate(130 52)"><circle r="20" fill="none" stroke="${c}" stroke-width="5"/><path d="M-14 14 14-14" stroke="${c}" stroke-width="5"/></g>`,
  regulation: (c) => `<g transform="rotate(-30 70 46)"><rect x="40" y="30" width="44" height="22" rx="4" fill="#e9edf3"/><rect x="58" y="52" width="8" height="40" rx="3" fill="#c9a77a"/></g>
    <rect x="86" y="72" width="54" height="12" rx="3" fill="${c}"/><path d="M78 88h70" stroke="#5a6372" stroke-width="2"/>
    <path d="M104 50l6 6M118 46v8M130 52l-6 6" stroke="#ffd84d" stroke-width="3" stroke-linecap="round"/>`,
  "ai-boom": (c) => `<rect x="44" y="24" width="52" height="52" rx="8" fill="#e9edf3"/><rect x="54" y="34" width="32" height="32" rx="4" fill="#0b0d10"/>
    <text x="70" y="56" fill="${c}" font-size="15" font-weight="800" text-anchor="middle" font-family="Inter,sans-serif">AI</text>
    ${[32, 44, 56, 68].map((v) => `<path d="M${v + 20} 18v6M${v + 20} 76v6M38 ${v - 2}h6M96 ${v - 2}h6" stroke="#aab3c0" stroke-width="3" stroke-linecap="round"/>`).join("")}` + ARROW_UP(134, c),
  "supply-chain": (c) => `<g fill="none" stroke="#e9edf3" stroke-width="7"><rect x="18" y="40" width="40" height="22" rx="11"/><rect x="44" y="40" width="40" height="22" rx="11" stroke="#aab3c0"/></g>
    <g fill="none" stroke="#e9edf3" stroke-width="7" transform="rotate(14 120 52)"><rect x="98" y="42" width="40" height="22" rx="11"/></g>
    <path d="M90 34l4 10M96 30l8 6M88 66l6 -6" stroke="${c}" stroke-width="3" stroke-linecap="round"/>`,
  energy: (c) => `<path d="M76 10 46 56h22l-8 36 34-50H70z" fill="${c}"/>
    <path d="M112 78a20 20 0 0 1 36 0" stroke="#e9edf3" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M130 78l12-14" stroke="#ff5c5c" stroke-width="4" stroke-linecap="round"/><circle cx="130" cy="78" r="4" fill="#e9edf3"/>`,
  conflict: (c) => `<circle cx="62" cy="52" r="32" fill="#2b4a6b"/><path d="M40 34c8 4 10 12 18 12s6 10 14 10M56 22c4 6 14 4 16 10M74 68c-6 -6 -14 -2 -18 6M88 44c-6 2-6 10 0 12" stroke="#2fd27a" stroke-width="6" fill="none" stroke-linecap="round" opacity=".7"/>
    <circle cx="62" cy="52" r="32" fill="none" stroke="#e9edf3" stroke-width="2.5"/>
    <path d="M124 22l24 42h-48z" fill="${c}"/><path d="M124 36v14" stroke="#0b0d10" stroke-width="4" stroke-linecap="round"/><circle cx="124" cy="57" r="2.6" fill="#0b0d10"/>`,
};

export function picture(sc) {
  return `<svg viewBox="0 0 160 100" role="img" aria-label="${sc.title}" xmlns="http://www.w3.org/2000/svg">
    <rect width="160" height="100" fill="${sc.ink}" opacity=".10"/><circle cx="140" cy="10" r="46" fill="${sc.ink}" opacity=".08"/>
    ${SCENES[sc.id](sc.ink)}</svg>`;
}
