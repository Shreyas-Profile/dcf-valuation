// Step-by-step path through a valuation: Base → Sandbox → Macro → Analysis → Save.
// Adds a step bar under the page header and a "Next" button at the bottom of the page.
// Users can still jump between steps by tapping them.
//   <script type="module" src="/js/flow.js?v=1"></script>

const STEPS = [
  { key: "base", label: "Base", url: (t) => `/company?t=${t}#base` },
  { key: "sandbox", label: "Sandbox", url: (t) => `/company?t=${t}#sandbox` },
  { key: "macro", label: "Macro", url: (t) => `/macro?t=${t}` },
  { key: "analysis", label: "Analysis", url: (t) => `/analysis?t=${t}` },
  { key: "save", label: "Save", url: (t) => `/save?t=${t}` },
];
const NEXT_TEXT = {
  base: "Next: change the assumptions",
  sandbox: "Next: test world events",
  macro: "Next: compare all companies",
  analysis: "Next: save your valuation",
};

const ORDER = ["MSFT", "AAPL", "GOOGL", "NVDA", "META"];
function ticker() {
  const q = (new URLSearchParams(location.search).get("t") || "").toUpperCase();
  if (ORDER.includes(q)) return q;
  try { const s = localStorage.getItem("lastTicker"); if (ORDER.includes(s)) return s; } catch {}
  try { const d = JSON.parse(localStorage.getItem("prefs") || "{}").defaultTicker; if (ORDER.includes(d)) return d; } catch {}
  return "MSFT";
}
function current() {
  const p = location.pathname;
  if (p.startsWith("/company")) return location.hash === "#sandbox" ? "sandbox" : "base";
  if (p.startsWith("/macro")) return "macro";
  if (p.startsWith("/analysis")) return "analysis";
  if (p.startsWith("/save")) return "save";
  return null;
}

const css = `
.flow { display: grid; grid-template-columns: repeat(5, 1fr); gap: 4px; margin: 0 0 14px; }
.flow a { display: flex; flex-direction: column; align-items: center; gap: 5px; text-decoration: none; color: #8b93a1; font: 600 11px Inter, system-ui, sans-serif; }
.flow a i { width: 100%; height: 4px; border-radius: 2px; background: #262b33; }
.flow a.done i { background: rgba(47,210,122,.45); }
.flow a.on i { background: #2fd27a; }
.flow a.on { color: #f2f4f7; }
.flow-next { display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; height: 52px; margin: 6px 0 16px; border-radius: 14px;
  background: #2fd27a; color: #04140b; font: 700 15px Inter, system-ui, sans-serif; text-decoration: none; }
.flow-next:hover { filter: brightness(1.05); }
`;

function render() {
  const cur = current();
  if (!cur) return;
  const t = ticker();
  const idx = STEPS.findIndex((s) => s.key === cur);
  let bar = document.querySelector(".flow");
  if (!bar) {
    bar = document.createElement("div"); // not <nav>: the pages style every <nav> as the bottom bar
    bar.className = "flow";
    bar.setAttribute("role", "navigation");
    bar.setAttribute("aria-label", "Valuation steps");
    document.querySelector("header")?.after(bar);
  }
  bar.innerHTML = STEPS.map((s, i) =>
    `<a href="${s.url(t)}" class="${i === idx ? "on" : i < idx ? "done" : ""}"${i === idx ? ' aria-current="step"' : ""}><i></i>${s.label}</a>`).join("");

  let next = document.querySelector(".flow-next");
  const nxt = STEPS[idx + 1];
  if (!nxt) { next?.remove(); return; }
  if (!next) {
    next = document.createElement("a");
    next.className = "flow-next";
    document.querySelector(".app")?.appendChild(next);
  }
  next.href = nxt.url(t);
  next.innerHTML = `${NEXT_TEXT[cur]} <span aria-hidden="true">→</span>`;
}

const style = document.createElement("style");
style.textContent = css;
document.head.appendChild(style);
render();
window.addEventListener("hashchange", render);
// The Macro page can switch company without reloading.
window.addEventListener("dcf:ticker", render);
