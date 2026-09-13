"use client";

import { useEffect, useState } from "react";

export type DashboardTheme = "dark" | "light";

const STORAGE_KEY = "barracks-theme";

function applyTheme(theme: DashboardTheme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = useState<DashboardTheme>("dark");

  useEffect(() => {
    const activeTheme = document.documentElement.dataset.theme === "light" ? "light" : "dark";
    setTheme(activeTheme);
    applyTheme(activeTheme);
  }, []);

  function toggleTheme() {
    const nextTheme: DashboardTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    applyTheme(nextTheme);

    try {
      window.localStorage.setItem(STORAGE_KEY, nextTheme);
    } catch {
      // Theme still works for the current session when storage is unavailable.
    }
  }

  const nextLabel = theme === "dark" ? "light" : "dark";

  return (
    <button
      className={`theme-toggle ${compact ? "theme-toggle--compact" : ""}`}
      type="button"
      aria-label={`Switch to ${nextLabel} mode`}
      title={`Switch to ${nextLabel} mode`}
      aria-pressed={theme === "light"}
      onClick={toggleTheme}
    >
      <span className="theme-toggle__icon" aria-hidden="true">
        {theme === "dark" ? "☀" : "☾"}
      </span>
      {!compact && <span>{theme === "dark" ? "Light mode" : "Dark mode"}</span>}
    </button>
  );
}
