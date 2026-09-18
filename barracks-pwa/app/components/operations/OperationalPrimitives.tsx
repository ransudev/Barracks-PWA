"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Badge, Button, SearchInput } from "@/app/components/ui";
import { Icon, type IconName } from "@/app/components/ui/icons";
import { useDrawerPresence } from "@/app/hooks/useDrawerPresence";

export type OperationalViewMode = "cards" | "table";

export function ViewToggle({
  view,
  onChange,
  label = "Choose view",
}: {
  view: OperationalViewMode;
  onChange: (view: OperationalViewMode) => void;
  label?: string;
}) {
  return (
    <div className="inventory-view-toggle operational-view-toggle" role="group" aria-label={label}>
      <button type="button" className={view === "cards" ? "is-active" : ""} aria-pressed={view === "cards"} onClick={() => onChange("cards")}>
        <Icon name="box" size={15} />
        <span>Cards</span>
      </button>
      <button type="button" className={view === "table" ? "is-active" : ""} aria-pressed={view === "table"} onClick={() => onChange("table")}>
        <Icon name="menu" size={15} />
        <span>List</span>
      </button>
    </div>
  );
}

export function FilterToolbar({
  search,
  onSearchChange,
  placeholder,
  filters,
  resultCount,
  children,
}: {
  search?: string;
  onSearchChange?: (value: string) => void;
  placeholder?: string;
  filters?: ReactNode;
  resultCount?: number;
  children?: ReactNode;
}) {
  return (
    <div className="operational-toolbar">
      <div className="operational-toolbar__inputs">
        {typeof search === "string" && onSearchChange && <SearchInput className="operational-toolbar__search" value={search} onChange={onSearchChange} placeholder={placeholder} />}
        {filters}
        {children}
      </div>
      <div className="operational-toolbar__meta">
        {typeof resultCount === "number" && <span>{resultCount} {resultCount === 1 ? "record" : "records"}</span>}
      </div>
    </div>
  );
}

export function RecordCard({
  children,
  onOpen,
  className = "",
  ariaLabel,
}: {
  children: ReactNode;
  onOpen?: () => void;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <article className={`operational-card ${className}`}>
      {onOpen ? (
        <button className="operational-card__main" type="button" onClick={onOpen} aria-label={ariaLabel}>
          {children}
        </button>
      ) : children}
    </article>
  );
}

export function ResponsiveTable({
  headers,
  children,
  className = "",
  empty,
}: {
  headers: string[];
  children: ReactNode;
  className?: string;
  empty?: ReactNode;
}) {
  return (
    <div className={`operational-table-wrap ${className}`}>
      <table className="operational-table">
        <thead><tr>{headers.map((header) => <th key={header} scope="col">{header}</th>)}</tr></thead>
        <tbody>{children}</tbody>
      </table>
      {empty}
    </div>
  );
}

export function ActionMenu({
  label = "More actions",
  icon = "more",
  children,
}: {
  label?: string;
  icon?: IconName;
  children: ReactNode;
}) {
  return (
    <details className="operational-action-menu">
      <summary className="icon-button icon-button--small" aria-label={label} title={label}><Icon name={icon} size={16} /></summary>
      <div className="operational-action-menu__content" role="menu">{children}</div>
    </details>
  );
}

export function ActionMenuItem({
  children,
  onClick,
  danger = false,
  disabled = false,
}: {
  children: ReactNode;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return <button type="button" role="menuitem" className={`operational-action-menu__item ${danger ? "is-danger" : ""}`} onClick={onClick} disabled={disabled}>{children}</button>;
}

export function OperationalStatusBadge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger" | "info" | "purple";
}) {
  return <Badge tone={tone}>{children}</Badge>;
}

export function DrawerSection({
  eyebrow,
  title,
  action,
  children,
  className = "",
}: {
  eyebrow?: string;
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return <section className={`operational-drawer__section ${className}`}><div className="operational-drawer__section-heading"><div>{eyebrow && <span className="inventory-kicker">{eyebrow}</span>}{title && <h3>{title}</h3>}</div>{action}</div>{children}</section>;
}

export function DetailDrawer({
  open,
  title,
  subtitle,
  eyebrow = "Record detail",
  onClose,
  children,
  footer,
  dirty = false,
  onDiscard,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  eyebrow?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  dirty?: boolean;
  onDiscard?: () => void;
}) {
  const drawerRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const { mounted, phase } = useDrawerPresence(open);

  // Every consumer clears its selected record the moment the drawer closes, so
  // hold the last populated content to give the exit transition something to
  // animate out instead of emptying first.
  const lastContent = useRef({ title, subtitle, eyebrow, children, footer });
  useEffect(() => {
    if (open) lastContent.current = { title, subtitle, eyebrow, children, footer };
  });
  // Reading the cache during render is deliberate: it is the only way a drawer
  // that every consumer empties on close can still animate out with its content.
  // eslint-disable-next-line react-hooks/refs
  const cached = lastContent.current;
  const content = phase === "exiting" ? cached : { title, subtitle, eyebrow, children, footer };
  const closeLabel = content.title.toLowerCase().endsWith("details") ? `Close ${content.title}` : `Close ${content.title} details`;

  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const drawer = drawerRef.current;
    if (!drawer) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusableSelector = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (dirty) setConfirmDiscard(true); else onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const controls = Array.from(drawer.querySelectorAll<HTMLElement>(focusableSelector));
      if (!controls.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    const frame = window.requestAnimationFrame(() => closeRef.current?.focus());
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
      setConfirmDiscard(false);
    };
  }, [dirty, open]);

  if (!mounted) return null;

  function requestClose() {
    if (dirty) setConfirmDiscard(true); else onClose();
  }

  function discardChanges() {
    setConfirmDiscard(false);
    onDiscard?.();
    onClose();
  }

  return (
    <div className="operational-drawer-layer" role="presentation" data-state={phase}>
      <button className="operational-drawer-scrim" type="button" aria-label={closeLabel} onClick={requestClose} />
      <aside ref={drawerRef} className="operational-drawer" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className="operational-drawer__header">
          <div><span className="inventory-kicker">{content.eyebrow}</span><h2 id={titleId}>{content.title}</h2>{content.subtitle && <p>{content.subtitle}</p>}</div>
          <button ref={closeRef} className="icon-button" type="button" aria-label={closeLabel} title="Close details" onClick={requestClose}><Icon name="x" size={18} /></button>
        </header>
        <div className="operational-drawer__body">{content.children}</div>
        {confirmDiscard && <div className="operational-drawer__unsaved" role="alert"><div><strong>Discard unsaved changes?</strong><span>Your edits will be lost.</span></div><div><Button size="sm" variant="ghost" type="button" onClick={() => setConfirmDiscard(false)}>Keep editing</Button><Button size="sm" variant="danger" type="button" onClick={discardChanges}>Discard</Button></div></div>}
        {content.footer && <footer className="operational-drawer__footer">{content.footer}</footer>}
      </aside>
    </div>
  );
}
