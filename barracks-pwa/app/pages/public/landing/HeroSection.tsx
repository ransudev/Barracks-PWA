"use client";

import Image from "next/image";
import { Icon } from "@/app/components/ui/icons";
import { landingEditorialImages } from "@/app/data/landing";
import type { ViewId } from "@/app/types/domain";

export function HeroSection({ go }: { go: (view: ViewId) => void }) {
  return (
    <section className="hero-gogrin" id="home">
      <div className="hero-gogrin__bg">
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
        <div className="hero-kicker">
          <span className="hero-kicker__rule" />
          <div className="hero-kicker__icon">
            <Image
              src="/barracks/tab-icon.png"
              alt=""
              width={42}
              height={42}
              className="hero-kicker__mark"
            />
          </div>
          <span className="hero-kicker__label">Est. 2017 · Homegrown in Davao</span>
          <span className="hero-kicker__rule" />
        </div>
        <p className="hero-gogrin__eyebrow">Davao&apos;s premier barber café &amp; grooming HQ</p>

        <h1>
          <span>Giving a modern</span>
          <span>twist</span>
          <span className="accent-crimson">to a traditional</span>
          <span className="accent-crimson">barbershop.</span>
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

      <div className="hero-footline" aria-hidden="true">
        <span>More than a haircut</span>
        <span className="hero-footline__rule" />
        <span>Davao City <b>×</b> Est. 2017</span>
        <span className="hero-footline__rule hero-footline__rule--short" />
      </div>
    </section>
  );
}
