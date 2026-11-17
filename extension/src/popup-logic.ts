// The popup's decisions, kept apart from the DOM wiring in popup.ts so they can be tested.
import type { RunMessage, StatusMessage } from "./background.ts";
import type { RunOptions } from "./core/pipeline.ts";

export interface StartApi {
  activeTab(): Promise<{ id?: number; windowId: number } | undefined>;
  send(msg: RunMessage): Promise<{ ok: boolean; error?: string } | undefined>;
}

export type StartResult = { ok: true } | { ok: false; error: string };

/** Hands the run to the service worker. The debugger is a normal permission, so nothing is asked here (P-027). */
export async function startCapture(api: StartApi, ids: string[], opts: Partial<RunOptions>): Promise<StartResult> {
  const tab = await api.activeTab();
  if (tab?.id === undefined) return { ok: false, error: "No active tab." };
  const res = await api.send({ type: "run", tabId: tab.id, windowId: tab.windowId, ids, opts });
  return res?.ok ? { ok: true } : { ok: false, error: res?.error ?? "Could not start." };
}

/** The status line for a finished capture. It is an error only when nothing was saved. */
export function doneStatus(msg: Extract<StatusMessage, { type: "done" }>): { text: string; isError: boolean } {
  const errs = Object.entries(msg.errors);
  const problems = errs.length ? `\nProblems:\n${errs.map(([k, v]) => `${k}: ${v}`).join("\n")}` : "";
  return { text: `${msg.files.length} files saved to Downloads/${msg.folder}${problems}`, isError: errs.length > 0 && !msg.files.length };
}

/** Makes a group of checkboxes single-choice: ticking one clears the others. */
export function singleChoice(group: HTMLElement) {
  group.addEventListener("change", (e) => {
    const target = e.target as HTMLInputElement;
    if (target.checked) for (const b of group.querySelectorAll("input")) if (b !== target) b.checked = false;
  });
}
