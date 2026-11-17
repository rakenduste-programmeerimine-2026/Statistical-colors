"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { AnalysisService } from "@/core/analysis/analysis-service";
import type { ThemeStore } from "@/core/theme/theme-store";
import { LocalThemeStore } from "./browser/local-theme-store";
import { withDemo } from "./demo/with-demo";
import { StubAnalysisService } from "./stub/stub-analysis-service";

export interface Services {
  analysis: AnalysisService;
  themes: ThemeStore;
}

/** Wiring for the running app. Swap the stub for the real adapter in #40. */
function defaultServices(): Services {
  const session = typeof window === "undefined" ? undefined : window.sessionStorage;
  return {
    analysis: withDemo(new StubAnalysisService(session)),
    themes: new LocalThemeStore(),
  };
}

let appServices: Services | undefined;
const ServicesContext = createContext<Services | undefined>(undefined);

/** Lets tests inject fakes; the app uses the default wiring. */
export function ServicesProvider({ services, children }: { services: Services; children: ReactNode }) {
  return <ServicesContext.Provider value={services}>{children}</ServicesContext.Provider>;
}

export function useServices(): Services {
  const injected = useContext(ServicesContext);
  if (injected) return injected;
  // Services hold browser state, so only the browser gets the shared instance.
  if (typeof window === "undefined") return defaultServices();
  appServices ??= defaultServices();
  return appServices;
}
