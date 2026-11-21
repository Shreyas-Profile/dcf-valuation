// "Ask AI" chat helper, added to every page with:
//   <script type="module" src="/js/chat.js?v=1" data-bottom="84"></script>
// data-bottom = how far above the bottom of the screen the button sits (px).
// A page can describe what's on screen by setting window.dcfChatContext = () => "text".

const me = document.currentScript || document.querySelector('script[src^="/js/chat.js"]');
const BOTTOM = Number(me?.dataset.bottom ?? 84);
const STORE = "dcf-chat";
const SUGGEST = {
  default: ["What is a DCF?", "What is WACC?", "Why is terminal value so big?"],
  base: ["Explain this valuation simply", "Why is the value different from the price?", "What does beta do?"],
  sandbox: ["Explain what my changes did", "Which slider matters most?", "What is a sensible terminal growth?"],
  macro: ["Why do rate hikes lower the value?", "Explain this scenario", "Which scenario hurts most?"],
  analysis: ["Which company looks cheapest?", "Why is NVIDIA so sensitive?", "What does TV share mean?"],
};

const css = `
.ai-fab { position: fixed; right: max(16px, calc(50% - 224px)); bottom: calc(${BOTTOM}px + env(safe-area-inset-bottom)); z-index: 20;
  display: flex; align-items: center; gap: 7px; padding: 11px 16px 11px 13px; border-radius: 999px; border: 1px solid rgba(47,210,122,.45);
  background: #12221a; color: #2fd27a; font: 600 14px Inter, system-ui, sans-serif; cursor: pointer; box-shadow: 0 8px 24px rgba(0,0,0,.45); }
.ai-fab svg { width: 18px; height: 18px; }
.ai-fab:hover { background: #163024; }
.ai-bg { position: fixed; inset: 0; background: rgba(0,0,0,.55); z-index: 30; opacity: 0; pointer-events: none; transition: opacity .2s; }
.ai-bg.show { opacity: 1; pointer-events: auto; }
.ai-panel { position: fixed; left: 50%; bottom: 0; width: 100%; max-width: 480px; height: min(86dvh, 720px); z-index: 31; transform: translate(-50%, 102%);
  transition: transform .25s ease; background: #0b0d10; color: #f2f4f7; border: 1px solid #262b33; border-bottom: none; border-radius: 22px 22px 0 0;
  display: flex; flex-direction: column; font: 14px/1.5 Inter, system-ui, sans-serif; }
.ai-panel.show { transform: translate(-50%, 0); }
.ai-head { display: flex; align-items: center; gap: 10px; padding: 14px 14px 12px 18px; border-bottom: 1px solid #262b33; }
.ai-head b { flex: 1; font-size: 16px; }
.ai-head b small { display: block; font-weight: 500; font-size: 11.5px; color: #8b93a1; }
.ai-btn { background: #15181d; border: 1px solid #262b33; color: #8b93a1; border-radius: 10px; padding: 7px 10px; font: 600 12px Inter, sans-serif; cursor: pointer; }
.ai-x { width: 34px; height: 34px; padding: 0; display: grid; place-items: center; border-radius: 50%; color: #f2f4f7; }
.ai-log { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 12px; overscroll-behavior: contain; }
.ai-msg { max-width: 88%; padding: 10px 13px; border-radius: 16px; word-wrap: break-word; }
.ai-msg.user { align-self: flex-end; background: #1f3a2c; border-bottom-right-radius: 5px; white-space: pre-wrap; }
.ai-msg.bot { align-self: flex-start; background: #15181d; border: 1px solid #262b33; border-bottom-left-radius: 5px; }
.ai-msg.bot p + p, .ai-msg.bot p + ul, .ai-msg.bot ul + p, .ai-msg.bot p + ol, .ai-msg.bot ol + p { margin-top: 8px; }
.ai-msg.bot ul, .ai-msg.bot ol { padding-left: 20px; margin: 0; }
.ai-msg.bot li + li { margin-top: 3px; }
.ai-msg.bot code { font-family: "JetBrains Mono", monospace; font-size: 12.5px; background: #1c2027; padding: 1px 4px; border-radius: 4px; }
.ai-msg.err { align-self: flex-start; background: rgba(255,92,92,.12); color: #ff8a8a; }
.ai-dots span { display: inline-block; width: 6px; height: 6px; margin: 0 2px; border-radius: 50%; background: #8b93a1; animation: ai-b 1s infinite; }
.ai-dots span:nth-child(2) { animation-delay: .15s; } .ai-dots span:nth-child(3) { animation-delay: .3s; }
@keyframes ai-b { 0%, 80%, 100% { opacity: .3; } 40% { opacity: 1; } }
.ai-empty { color: #8b93a1; font-size: 13.5px; text-align: center; margin: auto 0 4px; }
.ai-empty b { display: block; color: #f2f4f7; font-size: 15px; margin-bottom: 4px; }
.ai-sugg { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; }
.ai-sugg button { background: #15181d; border: 1px solid #262b33; color: #f2f4f7; border-radius: 999px; padding: 7px 12px; font: 13px Inter, sans-serif; cursor: pointer; }
.ai-sugg button:hover { border-color: #2fd27a; }
.ai-form { display: flex; gap: 8px; padding: 10px 12px calc(12px + env(safe-area-inset-bottom)); border-top: 1px solid #262b33; }
.ai-form textarea { flex: 1; resize: none; height: 44px; max-height: 120px; background: #15181d; color: #f2f4f7; border: 1px solid #262b33; border-radius: 14px;
  padding: 11px 13px; font: 15px/1.4 Inter, system-ui, sans-serif; outline: none; overflow-y: auto; scrollbar-width: none; }
.ai-form textarea:focus { border-color: #2fd27a; }
.ai-send { width: 44px; height: 44px; flex: none; border-radius: 50%; border: none; background: #2fd27a; color: #04140b; display: grid; place-items: center; cursor: pointer; }
.ai-send:disabled { opacity: .4; cursor: default; }
.ai-note { text-align: center; font-size: 11px; color: #5d6573; padding: 0 12px 6px; }
`;

const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const inline = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/`([^`]+)`/g, "<code>$1</code>");

// Tiny Markdown: paragraphs, bullet and numbered lists, **bold**, `code`. Everything is escaped first.
export function render(md) {
  const out = [];
  let list = null;
  const close = () => { if (list) { out.push(`</${list}>`); list = null; } };
  let para = [];
  const flush = () => { if (para.length) { out.push(`<p>${para.map(inline).join("<br>")}</p>`); para = []; } };
  for (const raw of md.replace(/\r/g, "").split("\n")) {
    const line = raw.replace(/^#{1,6}\s+/, "");
    const ul = line.match(/^\s*[-*•]\s+(.*)/);
    const ol = line.match(/^\s*\d+[.)]\s+(.*)/);
    if (ul || ol) {
      flush();
      const kind = ul ? "ul" : "ol";
      if (list !== kind) { close(); out.push(`<${kind}>`); list = kind; }
      out.push(`<li>${inline((ul || ol)[1])}</li>`);
    } else if (!line.trim()) { flush(); close(); }
    else { close(); para.push(line); }
  }
  flush(); close();
  return out.join("");
}

function page() {
  const p = location.pathname;
  if (p.startsWith("/company")) return location.hash === "#sandbox" ? "sandbox" : "base";
  if (p.startsWith("/macro")) return "macro";
  if (p.startsWith("/analysis")) return "analysis";
  return "default";
}

let history = [];
try { history = JSON.parse(sessionStorage.getItem(STORE) || "[]").filter((m) => m && typeof m.content === "string"); } catch {}
const save = () => { try { sessionStorage.setItem(STORE, JSON.stringify(history.slice(-30))); } catch {} };

const style = document.createElement("style");
style.textContent = css;
document.head.appendChild(style);

const fab = document.createElement("button");
fab.className = "ai-fab";
fab.type = "button";
fab.setAttribute("aria-label", "Ask AI");
fab.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.5l1.9 5.6 5.6 1.9-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.9zM19 15l.9 2.1 2.1.9-2.1.9L19 21l-.9-2.1-2.1-.9 2.1-.9z"/></svg>Ask AI`;

const bg = document.createElement("div");
bg.className = "ai-bg";
const panel = document.createElement("section");
panel.className = "ai-panel";
panel.setAttribute("role", "dialog");
panel.setAttribute("aria-modal", "true");
panel.setAttribute("aria-label", "Ask AI");
panel.hidden = true;
panel.innerHTML = `
  <div class="ai-head"><b>Ask AI<small>Questions about DCF and this app</small></b>
    <button class="ai-btn" type="button" data-ai="clear">Clear</button>
    <button class="ai-btn ai-x" type="button" data-ai="close" aria-label="Close"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div>
  <div class="ai-log" aria-live="polite"></div>
  <form class="ai-form"><textarea rows="1" maxlength="2000" placeholder="Ask anything about DCF…" aria-label="Your question"></textarea>
    <button class="ai-send" type="submit" aria-label="Send"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg></button></form>
  <div class="ai-note">AI can make mistakes. Not financial advice.</div>`;
document.body.append(fab, bg, panel);

const log = panel.querySelector(".ai-log");
const input = panel.querySelector("textarea");
const send = panel.querySelector(".ai-send");
let busy = false;

function bubble(role, html) {
  const d = document.createElement("div");
  d.className = "ai-msg " + role;
  d.innerHTML = html;
  log.appendChild(d);
  return d;
}

function draw() {
  log.innerHTML = "";
  if (!history.length) {
    const box = document.createElement("div");
    box.className = "ai-empty";
    box.innerHTML = `<b>Hi! Ask me about this page.</b>I can explain DCF, WACC, the sliders, scenarios and the numbers you're looking at.`;
    const sugg = document.createElement("div");
    sugg.className = "ai-sugg";
    sugg.innerHTML = (SUGGEST[page()] || SUGGEST.default).map((q) => `<button type="button">${esc(q)}</button>`).join("");
    log.append(box, sugg);
    return;
  }
  history.forEach((m) => bubble(m.role === "user" ? "user" : "bot", m.role === "user" ? esc(m.content) : render(m.content)));
  log.scrollTop = log.scrollHeight;
}

let lastFocus = null;
function open() {
  lastFocus = document.activeElement;
  panel.hidden = false;
  draw();
  void panel.offsetHeight;
  panel.classList.add("show");
  bg.classList.add("show");
  document.body.style.overflow = "hidden";
  setTimeout(() => input.focus({ preventScroll: true }), 50);
}
function close() {
  panel.classList.remove("show");
  bg.classList.remove("show");
  document.body.style.overflow = "";
  setTimeout(() => { if (!panel.classList.contains("show")) panel.hidden = true; }, 260);
  lastFocus?.focus?.({ preventScroll: true });
}

function context() {
  let c = `Page: ${location.pathname}${location.hash}`;
  try { if (typeof window.dcfChatContext === "function") c += "\n" + window.dcfChatContext(); } catch {}
  return c.slice(0, 5000);
}

async function ask(q) {
  q = q.trim();
  if (!q || busy) return;
  busy = true;
  send.disabled = true;
  history.push({ role: "user", content: q });
  save();
  draw();
  const out = bubble("bot", `<span class="ai-dots"><span></span><span></span><span></span></span>`);
  log.scrollTop = log.scrollHeight;
  let text = "";
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: history.slice(-12), context: context() }),
    });
    if (!res.ok || !res.body) {
      const j = await res.json().catch(() => ({}));
      throw new Error(j.error || "The AI isn't available right now.");
    }
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      text += dec.decode(value, { stream: true });
      out.innerHTML = render(text);
      log.scrollTop = log.scrollHeight;
    }
    if (!text.trim()) throw new Error("The AI didn't answer. Try again.");
    history.push({ role: "assistant", content: text });
    save();
  } catch (e) {
    out.className = "ai-msg err";
    out.textContent = text ? text + "\n\n(The answer was cut off. Try again.)" : e.message || "Something went wrong.";
    history.pop(); // forget the question so a retry doesn't send it twice
    save();
  } finally {
    busy = false;
    send.disabled = false;
  }
}

fab.addEventListener("click", open);
bg.addEventListener("click", close);
panel.addEventListener("click", (e) => {
  const a = e.target.closest("[data-ai]")?.dataset.ai;
  if (a === "close") close();
  if (a === "clear") { history = []; save(); draw(); input.focus(); }
  const s = e.target.closest(".ai-sugg button");
  if (s) ask(s.textContent);
});
panel.querySelector("form").addEventListener("submit", (e) => {
  e.preventDefault();
  const q = input.value;
  input.value = "";
  input.style.height = "";
  ask(q);
});
input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); panel.querySelector("form").requestSubmit(); }
});
input.addEventListener("input", () => { input.style.height = "auto"; input.style.height = Math.min(input.scrollHeight, 120) + "px"; });
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && panel.classList.contains("show")) close(); });
