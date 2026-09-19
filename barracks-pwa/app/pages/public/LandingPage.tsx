"use client";

import { useEffect } from "react";
import type { ViewId } from "@/app/types/domain";
import { BranchesSection } from "./landing/BranchesSection";
import { FinalCta } from "./landing/FinalCta";
import { HeroSection } from "./landing/HeroSection";
import { PublicFooter } from "./landing/PublicFooter";
import { PublicHeader } from "./landing/PublicHeader";
import { ServicesSection } from "./landing/ServicesSection";
import { StudioSection } from "./landing/StudioSection";
import { WhyBarracksSection } from "./landing/WhyBarracksSection";

export function LandingPage({ go }: { go: (view: ViewId) => void }) {
  useEffect(() => {
    const site = document.querySelector<HTMLElement>(".public-site");

    if (!site) {
      return;
    }

    site.classList.add("motion-ready");

    const sections = Array.from(
      site.querySelectorAll<HTMLElement>("main > section:not(#home)"),
    );
    const parallaxTargets = Array.from(
      site.querySelectorAll<HTMLElement>(
        ".hero-gogrin__bg, .collage-quad__cell img, .services-menu-feature__image, .branches-carousel__media img, .studio-visual-frame img",
      ),
    );

    let frame = 0;
    const updateScrollMotion = () => {
      if (frame) {
        return;
      }

      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const viewportCenter = window.innerHeight / 2;

        parallaxTargets.forEach((target) => {
          const rect = target.getBoundingClientRect();
          const distanceFromCenter = (rect.top + rect.height / 2 - viewportCenter) / window.innerHeight;
          const shift = Math.max(-18, Math.min(18, distanceFromCenter * -12));
          target.style.setProperty("--scroll-shift", `${shift}px`);
        });

        const heroBackground = site.querySelector<HTMLElement>(".hero-gogrin__bg");
        heroBackground?.style.setProperty(
          "--hero-parallax",
          `${Math.min(110, window.scrollY * 0.16)}px`,
        );
      });
    };

    window.addEventListener("scroll", updateScrollMotion, { passive: true });
    window.addEventListener("resize", updateScrollMotion);
    updateScrollMotion();

    if (!("IntersectionObserver" in window)) {
      sections.forEach((section) => section.classList.add("is-visible"));
      return () => {
        window.removeEventListener("scroll", updateScrollMotion);
        window.removeEventListener("resize", updateScrollMotion);
        if (frame) {
          window.cancelAnimationFrame(frame);
        }
        site.classList.remove("motion-ready");
      };
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.12 },
    );

    sections.forEach((section) => observer.observe(section));

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", updateScrollMotion);
      window.removeEventListener("resize", updateScrollMotion);
      if (frame) {
        window.cancelAnimationFrame(frame);
      }
      site.classList.remove("motion-ready");
    };
  }, []);

  return (
    <div className="public-site" data-motion="full">
      <PublicHeader go={go} />
      <main>
        <HeroSection go={go} />
        <ServicesSection go={go} />
        <WhyBarracksSection />
        <BranchesSection go={go} />
        <StudioSection />
        <FinalCta go={go} />
      </main>
      <PublicFooter />
    </div>
  );
}
