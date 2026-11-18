"use client";

import { Button } from "@/components/ui/button";

/**
 * Manual theme switch. The initial attribute is set by the inline script in the
 * root layout, so there is no flash of the wrong theme and no state has to be
 * synchronized after mount. The icon is deliberately mode-neutral.
 */
export function ThemeToggle() {
  function toggle(): void {
    const current =
      document.documentElement.dataset.theme === "dark" ? "dark" : "light";
    const next = current === "dark" ? "light" : "dark";

    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("theme", next);
    } catch {
      // Storage can be blocked; the attribute still applies for this session.
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggle}
      aria-label="Toggle color theme"
      title="Toggle color theme"
      className="px-3"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        className="size-5"
      >
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
        <path d="M12 3a9 9 0 0 0 0 18V3Z" fill="currentColor" />
      </svg>
    </Button>
  );
}
