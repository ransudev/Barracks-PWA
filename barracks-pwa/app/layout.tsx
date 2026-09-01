import type { Metadata } from "next";
import { Geist, Geist_Mono, Libre_Baskerville } from "next/font/google";
import { BarracksApp } from "@/app/components/BarracksApp";
import "./globals.css";

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

export const metadata: Metadata = {
  title: "Barracks | Barbers & Shaves",
  description:
    "Premium grooming, homegrown in Davao. Barracks Barbers & Shaves brings a modern twist to traditional barbering.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${geistSans.variable} ${geistMono.variable} ${libreBaskerville.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/*
          THESIS: Barracks is a considered barbershop worth visiting, not a dashboard wearing a marketing skin.
          OWN-WORLD: warm ivory paper, near-black editorial blocks, quiet rules, restrained green and amber signals, and photography that carries the page.
          STORY: visitors understand the Barracks standard, browse services and barbers, find a Davao chair, and book an appointment.
          FIRST VIEWPORT: a compact light navbar above a dark two-column hero, followed immediately by a two-image tools-and-chair collage.
          FORM: brief-pinned reference-led editorial barbershop composition.
          FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and the repository README
        */}
        <BarracksApp />
        {children}
      </body>
    </html>
  );
}
