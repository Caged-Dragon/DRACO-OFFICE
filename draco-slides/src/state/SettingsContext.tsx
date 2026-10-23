import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  DEFAULT_SETTINGS,
  loadSettings,
  resolveTheme,
  saveSettings,
  type Settings,
} from "../services/settings/settingsStore";
import { useApp } from "./AppContext";

interface SettingsContextValue {
  settings: Settings;
  update: (next: Settings) => void;
}

// Components rendered without a provider (isolated tests) simply see the defaults.
const SettingsContext = createContext<SettingsContextValue>({ settings: DEFAULT_SETTINGS, update: () => {} });

const LIGHT_QUERY = "(prefers-color-scheme: light)";

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { notify } = useApp();
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const [prefersLight, setPrefersLight] = useState(
    () => typeof window.matchMedia === "function" && window.matchMedia(LIGHT_QUERY).matches,
  );

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia(LIGHT_QUERY);
    const onChange = () => setPrefersLight(mq.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = resolveTheme(settings.theme, prefersLight);
  }, [settings.theme, prefersLight]);

  const update = useCallback(
    (next: Settings) => {
      setSettings(next);
      if (!saveSettings(next)) {
        notify("error", "Settings could not be saved in this browser, so they will reset when you reload.");
      }
    },
    [notify],
  );

  const value = useMemo(() => ({ settings, update }), [settings, update]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  return useContext(SettingsContext);
}
