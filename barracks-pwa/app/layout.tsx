import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter, Libre_Baskerville, Sora } from "next/font/google";
import { BarracksApp } from "@/app/components/BarracksApp";
import "./globals.css";
import "./theme.css";
import "./pages/public/landing.css";
import "./pages/auth/login.css";
import "./pages/customer/booking.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const libreBaskerville = Libre_Baskerville({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

const dashboardSans = Inter({
  variable: "--font-dashboard-sans",
  subsets: ["latin"],
  display: "swap",
});

const dashboardAccent = Sora({
  variable: "--font-dashboard-accent",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Barracks | Barbers & Shaves",
  description:
    "Premium grooming, homegrown in Davao. Barracks Barbers & Shaves brings a modern twist to traditional barbering.",
  icons: {
    icon: "data:image/png;base64,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",
    shortcut: "data:image/png;base64,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",
    apple: "/barracks/tab-icon.png",
  },
};

const themeBootScript = `
  try {
    var storedTheme = localStorage.getItem("barracks-theme");
    var theme = storedTheme === "light" ? "light" : "dark";
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  } catch (_) {
    document.documentElement.dataset.theme = "dark";
    document.documentElement.style.colorScheme = "dark";
  }
`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      data-theme="dark"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${libreBaskerville.variable} ${dashboardSans.variable} ${dashboardAccent.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        {/*
          THESIS: Barracks is a considered barbershop worth visiting, not a dashboard wearing a marketing skin.
          OWN-WORLD: warm ivory paper, near-black editorial blocks, quiet rules, restrained green and amber signals, and photography that carries the page.
          STORY: visitors understand the Barracks standard, browse services and barbers, find a Davao chair, and book an appointment.
          FIRST VIEWPORT: a compact dark navbar over a cinematic, right-weighted hero with a large Barracks lockup, paired booking/service actions, and a three-part benefits rail.
          FORM: brief-pinned reference-led editorial barbershop composition.
          FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and the repository README
        */}
        <BarracksApp />
        {children}
      </body>
    </html>
  );
}
