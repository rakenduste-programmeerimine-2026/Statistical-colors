import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { ServicesProvider, type Services } from "@/adapters/services";
import { LocalThemeStore } from "@/adapters/browser/local-theme-store";
import { StubAnalysisService } from "@/adapters/stub/stub-analysis-service";
import { ThemeProvider } from "@/components/theme/ThemeProvider";

export function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
}

/** Fresh in-memory services for one test. */
export function testServices(overrides: Partial<Services> = {}): Services {
  const themeStorage = memoryStorage();
  return {
    analysis: new StubAnalysisService(memoryStorage()),
    themes: new LocalThemeStore(() => themeStorage),
    ...overrides,
  };
}

/** Renders inside the same providers the app layout uses. */
export function renderWithServices(ui: ReactElement, services: Services = testServices()) {
  return {
    services,
    ...render(
      <ServicesProvider services={services}>
        <ThemeProvider>{ui}</ThemeProvider>
      </ServicesProvider>,
    ),
  };
}
