"use client";

import type { ViewId } from "@/app/types/domain";
import { BranchesSection } from "./landing/BranchesSection";
import { FinalCta } from "./landing/FinalCta";
import { HeroSection } from "./landing/HeroSection";
import { PublicFooter } from "./landing/PublicFooter";
import { PublicHeader } from "./landing/PublicHeader";
import { ServicesSection } from "./landing/ServicesSection";
import { StudioSection } from "./landing/StudioSection";

export function LandingPage({ go }: { go: (view: ViewId) => void }) {
  return (
    <div className="public-site">
      <PublicHeader go={go} />
      <main>
        <HeroSection go={go} />
        <ServicesSection go={go} />
        <BranchesSection go={go} />
        <StudioSection />
        <FinalCta go={go} />
      </main>
      <PublicFooter />
    </div>
  );
}
