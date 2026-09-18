"use client";

import Image from "next/image";
import { Icon } from "@/app/components/ui/icons";
import { landingEditorialImages } from "@/app/data/landing";
import type { ViewId } from "@/app/types/domain";

export function HeroSection({ go }: { go: (view: ViewId) => void }) {
  return (
    <section className="hero-gogrin" id="home" style={{ position: "relative", overflow: "hidden" }}>
      <div className="hero-gogrin__bg" style={{ position: "absolute", inset: 0 }}>
        <Image
          src={landingEditorialImages.hero}
          alt="Barracks barber styling a client at Bajada HQ"
          fill
          priority
          sizes="100vw"
        />
      </div>
      <div className="hero-gogrin__overlay" />

      <div className="hero-gogrin__content">
        <div className="barbershop-crest">
          <div className="barbershop-crest__icon">
            <Image
              src="/barracks/tab-icon.png"
              alt=""
              width={34}
              height={34}
              className="barbershop-crest__mark"
            />
          </div>
          <span className="barbershop-crest__badge">EST. 2017 · HOMEGROWN IN DAVAO</span>
          <span className="barbershop-crest__meta">Davao&apos;s Premier Barber Café &amp; Grooming HQ</span>
        </div>

        <h1>
          GIVING A MODERN TWIST<br />
          <span className="accent-crimson">TO A TRADITIONAL BARBERSHOP.</span>
        </h1>

        <p className="hero-gogrin__lead">
          Homegrown in Davao City since 2017. Precision cuts, signature fades,
          beard sculpting, and modern gentleman&apos;s grooming by TESDA-certified
          master barbers. Enjoy great coffee, chill vibes, and leave looking sharp.
        </p>

        <div className="hero-gogrin__actions">
          <button
            type="button"
            className="btn-primary"
            onClick={() => go("customer-booking")}
          >
            <Icon name="calendar" size={16} />
            <span>Book Appointment</span>
          </button>
          <a href="#services" className="btn-outlined">
            <span>Explore Services</span>
            <Icon name="arrowRight" size={15} />
          </a>
        </div>
      </div>

      <div className="hero-dots" aria-hidden="true">
        <span className="hero-dot is-active" />
        <span className="hero-dot" />
        <span className="hero-dot" />
      </div>
    </section>
  );
}
