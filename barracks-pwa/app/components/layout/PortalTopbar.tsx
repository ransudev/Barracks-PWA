"use client";

import { Logo } from "@/app/components/ui";
import { ThemeToggle } from "@/app/components/ui/ThemeToggle";
import { AccountMenu } from "@/app/components/layout/AccountMenu";
import type { Tone } from "@/app/types/domain";

type PortalLink = { id: string; label: string };

// Topbar for the customer and supplier portals. It reuses the workspace
// topbar classes so height, surface, actions and account menu stay identical.
export function PortalTopbar({
  onHome,
  links = [],
  active,
  onNavigate,
  name,
  role,
  tone,
  onSignOut,
}: {
  onHome: () => void;
  links?: PortalLink[];
  active?: string;
  onNavigate?: (id: string) => void;
  name: string;
  role: string;
  tone?: Tone;
  onSignOut: () => void;
}) {
  return (
    <header className="topbar portal-topbar">
      <div className="portal-topbar__start">
        <Logo compact onClick={onHome} />
        {links.length > 0 && (
          <nav className="portal-topbar__nav" aria-label={`${role} navigation`}>
            {links.map((link) => (
              <button
                key={link.id}
                type="button"
                className={`portal-topbar__link ${active === link.id ? "is-active" : ""}`}
                aria-current={active === link.id ? "page" : undefined}
                onClick={() => onNavigate?.(link.id)}
              >
                {link.label}
              </button>
            ))}
          </nav>
        )}
      </div>
      <div className="topbar__actions">
        <ThemeToggle />
        <AccountMenu name={name} role={role} tone={tone} onSignOut={onSignOut} />
      </div>
    </header>
  );
}
