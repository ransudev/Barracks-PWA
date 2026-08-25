import type { ReactNode, SVGProps } from "react";

export type IconName =
  | "home"
  | "queue"
  | "calendar"
  | "users"
  | "wallet"
  | "box"
  | "settings"
  | "chart"
  | "briefcase"
  | "scissors"
  | "search"
  | "bell"
  | "plus"
  | "arrowRight"
  | "chevronDown"
  | "chevronRight"
  | "chevronLeft"
  | "check"
  | "clock"
  | "more"
  | "logOut"
  | "spark"
  | "lock"
  | "mail"
  | "phone"
  | "mapPin"
  | "download"
  | "filter"
  | "edit"
  | "refresh"
  | "userPlus"
  | "sliders"
  | "external"
  | "star"
  | "info"
  | "x"
  | "creditCard"
  | "cash"
  | "mobile"
  | "eye"
  | "eyeOff"
  | "menu"
  | "checkCircle"
  | "dot"
  | "arrowUp"
  | "arrowDown";

const paths: Record<IconName, ReactNode> = {
  home: (
    <>
      <path d="m3 10 9-7 9 7" />
      <path d="M5 9.5V21h14V9.5" />
      <path d="M9 21v-6h6v6" />
    </>
  ),
  queue: (
    <>
      <path d="M5 6h14" />
      <path d="M5 12h14" />
      <path d="M5 18h8" />
      <circle cx="18" cy="18" r="2" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="4.5" width="18" height="17" rx="2" />
      <path d="M16 2.5v4M8 2.5v4M3 9h18" />
      <path d="M8 13h.01M12 13h.01M16 13h.01M8 17h.01M12 17h.01" />
    </>
  ),
  users: (
    <>
      <path d="M16 20v-1.8a3.8 3.8 0 0 0-3.8-3.8H6.8A3.8 3.8 0 0 0 3 18.2V20" />
      <circle cx="9.5" cy="7.5" r="3.5" />
      <path d="M17 11a3.2 3.2 0 0 0 0-6.2M21 20v-1.6a3.8 3.8 0 0 0-2.8-3.7" />
    </>
  ),
  wallet: (
    <>
      <path d="M4 6.5h15a2 2 0 0 1 2 2V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6.5a2 2 0 0 1 2-2h12" />
      <path d="M3 9h18" />
      <path d="M16 15h.01" />
    </>
  ),
  box: (
    <>
      <path d="m12 3 8 4.2v9.6L12 21l-8-4.2V7.2L12 3Z" />
      <path d="m4.4 7.5 7.6 4 7.6-4M12 11.5V21" />
    </>
  ),
  settings: (
    <>
      <path d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z" />
      <path
        d="m19.4 15 .1.1a1.8 1.8 0 0 1-2.6 2.6l-.1-.1a1.8 1.8 0 0 0-3.1 1.3v.2a1.8 1.8 0 0 1-3.6 0v-.2a1.8 1.8 0 0 0-3.1-1.3l-.1.1a1.8 1.8 0 1 1-2.6-2.6l.1-.1A1.8 1.8 0 0 0 3.2 12a1.8 1.8 0 0 0-1.4-3.1h-.2a1.8 1.8 0 0 1 0-3.6h.2a1.8 1.8 0 0 0 1.3-3.1L3 2.1A1.8 1.8 0 1 1 5.6-.5l.1.1A1.8 1.8 0 0 0 8.8-1.7v-.2a1.8 1.8 0 0 1 3.6 0v.2a1.8 1.8 0 0 0 3.1 1.3l.1-.1a1.8 1.8 0 1 1 2.6 2.6l-.1.1A1.8 1.8 0 0 0 19.4 5a1.8 1.8 0 0 0 1.4 3.1h.2a1.8 1.8 0 0 1 0 3.6h-.2a1.8 1.8 0 0 0-1.4 3.3Z"
        transform="scale(.82) translate(2.6 2.6)"
      />
    </>
  ),
  chart: (
    <>
      <path d="M4 20V10" />
      <path d="M10 20V4" />
      <path d="M16 20v-7" />
      <path d="M22 20H2" />
    </>
  ),
  briefcase: (
    <>
      <rect x="3" y="6.5" width="18" height="13" rx="2" />
      <path d="M8 6.5v-2A1.5 1.5 0 0 1 9.5 3h5A1.5 1.5 0 0 1 16 4.5v2M3 11h18M10 11v2h4v-2" />
    </>
  ),
  scissors: (
    <>
      <circle cx="6.5" cy="7" r="2.5" />
      <circle cx="6.5" cy="17" r="2.5" />
      <path d="m8.6 8.4 10.1 10.1M8.6 15.6 18.7 5.5" />
    </>
  ),
  search: (
    <>
      <circle cx="10.7" cy="10.7" r="6.7" />
      <path d="m16 16 5 5" />
    </>
  ),
  bell: (
    <>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
    </>
  ),
  plus: (
    <>
      <path d="M12 5v14M5 12h14" />
    </>
  ),
  arrowRight: (
    <>
      <path d="M4 12h16M13 5l7 7-7 7" />
    </>
  ),
  chevronDown: <path d="m6 9 6 6 6-6" />,
  chevronRight: <path d="m9 6 6 6-6 6" />,
  chevronLeft: <path d="m15 6-6 6 6 6" />,
  check: <path d="m5 12 4.5 4.5L19 7" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  more: (
    <>
      <circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  logOut: (
    <>
      <path d="M10 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h5" />
      <path d="m15 16 4-4-4-4M19 12H9" />
    </>
  ),
  spark: (
    <>
      <path d="m12 3 1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6L12 3ZM19 16l.7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7L19 16Z" />
    </>
  ),
  lock: (
    <>
      <rect x="4" y="10" width="16" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </>
  ),
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m4 7 8 6 8-6" />
    </>
  ),
  phone: (
    <>
      <path d="M6.5 3.5 9 3l1.8 4.3-2.2 1.3a14 14 0 0 0 5.8 5.8l1.3-2.2L20 14l-.5 2.5a3 3 0 0 1-3.3 2.4C9.9 18 6 14.1 5.1 7.8a3 3 0 0 1 1.4-4.3Z" />
    </>
  ),
  mapPin: (
    <>
      <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  download: (
    <>
      <path d="M12 3v12M7 10l5 5 5-5M4 21h16" />
    </>
  ),
  filter: (
    <>
      <path d="M4 6h16M7 12h10M10 18h4" />
    </>
  ),
  edit: (
    <>
      <path d="m4 16.5-.8 4.3 4.3-.8L19 8.5a2.1 2.1 0 0 0-3-3L4 16.5Z" />
      <path d="m14.5 7.5 3 3" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 11a8 8 0 0 0-14.6-4L3 10" />
      <path d="M3 5v5h5M4 13a8 8 0 0 0 14.6 4L21 14" />
      <path d="M21 19v-5h-5" />
    </>
  ),
  userPlus: (
    <>
      <path d="M15 20v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20" />
      <circle cx="8.5" cy="7" r="3.5" />
      <path d="M19 8v6M16 11h6" />
    </>
  ),
  sliders: (
    <>
      <path d="M4 6h7M16 6h4M4 12h3M12 12h8M4 18h8M17 18h3" />
      <circle cx="13" cy="6" r="2" />
      <circle cx="9" cy="12" r="2" />
      <circle cx="15" cy="18" r="2" />
    </>
  ),
  external: (
    <>
      <path d="M14 4h6v6M20 4l-9 9" />
      <path d="M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5" />
    </>
  ),
  star: (
    <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z" />
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 7h.01" />
    </>
  ),
  x: (
    <>
      <path d="m5 5 14 14M19 5 5 19" />
    </>
  ),
  creditCard: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 10h18M7 15h3" />
    </>
  ),
  cash: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <circle cx="12" cy="12" r="3" />
      <path d="M7 9h.01M17 15h.01" />
    </>
  ),
  mobile: (
    <>
      <rect x="7" y="2.5" width="10" height="19" rx="2" />
      <path d="M10 5h4M11 18.5h2" />
    </>
  ),
  eye: (
    <>
      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
      <circle cx="12" cy="12" r="2.5" />
    </>
  ),
  eyeOff: (
    <>
      <path d="m3 3 18 18M10.6 6.2A10.9 10.9 0 0 1 12 6c6 0 9.5 6 9.5 6a18 18 0 0 1-3.2 3.6M6.7 6.8C4.1 8.3 2.5 12 2.5 12s3.5 6 9.5 6c1.2 0 2.3-.2 3.3-.6" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </>
  ),
  menu: (
    <>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </>
  ),
  checkCircle: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12 2.6 2.6L16 9" />
    </>
  ),
  dot: <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />,
  arrowUp: (
    <>
      <path d="M12 19V5M6 11l6-6 6 6" />
    </>
  ),
  arrowDown: (
    <>
      <path d="M12 5v14M18 13l-6 6-6-6" />
    </>
  ),
};

export function Icon({
  name,
  size = 18,
  strokeWidth = 1.8,
  ...props
}: {
  name: IconName;
  size?: number;
  strokeWidth?: number;
} & SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {paths[name]}
    </svg>
  );
}
