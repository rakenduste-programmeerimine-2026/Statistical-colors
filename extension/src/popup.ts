// The toolbar popup: choose what to capture, then hand the run to the service worker.
import type { RunMessage, StatusMessage } from "./background.ts";
import { BROWSERS, detectBrowser, envFrom, OS, type Brand, type Detected } from "./env.ts";
import { doneStatus, singleChoice, startCapture } from "./popup-logic.ts";
import { REGISTRY } from "./registry.ts";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

function status(text: string, isError = false) {
  $("status").textContent = text;
  $("status").classList.toggle("error", isError);
}

function checkbox(name: string, value: string, label: string, checked = false, note = "") {
  const wrap = document.createElement("label");
  const box = document.createElement("input");
  box.type = "checkbox";
  box.name = name;
  box.value = value;
  box.checked = checked;
  wrap.append(box, ` ${label}`);
  if (note) {
    const small = document.createElement("small");
    small.textContent = note;
    wrap.append(" ", small);
  }
  return wrap;
}

// Approaches arrive in #45; until then the section stays hidden.
$("recover").hidden = REGISTRY.approaches.length === 0;
for (const a of REGISTRY.approaches) {
  $("approaches").append(checkbox("approach", a.id, a.title, !a.needsDebugger, a.needsDebugger ? "needs debugger" : ""));
}
for (const [group, list] of [["os", OS], ["browser", BROWSERS]] as const) {
  for (const [value, name] of list) $(group).append(checkbox(group, value, name));
  singleChoice($(group));
}

const detected: Detected = { os: null, arch: null, browser: null, browserVersion: null };
void (async () => {
  try {
    const p = await chrome.runtime.getPlatformInfo();
    detected.os = p.os;
    detected.arch = p.arch;
  } catch {
    // Unknown platform: the user ticks it.
  }
  const nav = navigator as Navigator & { userAgentData?: { brands: Brand[] }; brave?: unknown };
  Object.assign(detected, detectBrowser(nav.userAgentData?.brands ?? [], Boolean(nav.brave)));
  for (const [group, value] of [["os", detected.os], ["browser", detected.browser]] as const) {
    const box = $(group).querySelector<HTMLInputElement>(`input[value="${value}"]`);
    if (box) box.checked = true;
  }
  const name = (list: readonly (readonly [string, string])[], v: string | null) => list.find(([k]) => k === v)?.[1];
  $("detected").textContent =
    detected.os || detected.browser
      ? `Detected: ${name(OS, detected.os) ?? "unknown OS"}, ${name(BROWSERS, detected.browser) ?? "unknown browser"}` +
        `${detected.browserVersion ? ` ${detected.browserVersion}` : ""}. Change only if wrong.`
      : "Could not detect; please tick your OS and browser.";
})();

chrome.runtime.onMessage.addListener((msg: StatusMessage) => {
  if (msg.type === "progress") status(`Running ${msg.text}…`);
  if (msg.type === "done") {
    const done = doneStatus(msg);
    status(done.text, done.isError);
    $<HTMLButtonElement>("go").disabled = false;
  }
});

$("go").addEventListener("click", async () => {
  const go = $<HTMLButtonElement>("go");
  go.disabled = true;
  status("Starting…");
  const ids = [...$("approaches").querySelectorAll<HTMLInputElement>("input:checked")].map((b) => b.value);
  const chosen = (g: string) => $(g).querySelector<HTMLInputElement>("input:checked")?.value ?? null;
  const env = envFrom({ os: chosen("os"), browser: chosen("browser") }, detected);
  // Runs inside the click, because Chrome shows the permission prompt only during one (P-023 item 6).
  const result = await startCapture(
    {
      requestDebugger: () => chrome.permissions.request({ permissions: ["debugger"] }),
      activeTab: async () => (await chrome.tabs.query({ active: true, currentWindow: true }))[0],
      send: (msg: RunMessage) => chrome.runtime.sendMessage(msg),
    },
    ids,
    REGISTRY.approaches,
    { scale: Number($<HTMLSelectElement>("scale").value), env },
  );
  if (!result.ok) {
    status(result.error, true);
    go.disabled = false;
  }
});
