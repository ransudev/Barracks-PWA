import Image from "next/image";
import { Button } from "@/app/components/ui";
import { landingEditorialImages } from "@/app/data/landing";
import type { ViewId } from "@/app/types/domain";

export function HeroSection({ go }: { go: (view: ViewId) => void }) {
  return (
    <section className="landing-hero landing-hero--reference" id="home">
      <div className="landing-hero__copy">
        <p className="hero-notation">HOMEGROWN IN DAVAO · EST. 2017</p>
        <h1>
          <span>Modern grooming.</span>
          <span><em>rooted in tradition.</em></span>
        </h1>
        <p className="landing-hero__lead">
          Premium grooming for the modern-day Dabawenyo, shaped by skilled
          craftsmanship, personal consultation, and a complete chair ritual.
        </p>
        <div className="landing-hero__actions">
          <Button size="md" icon="calendar" onClick={() => go("customer")}>
            Book Appointment
          </Button>
        </div>
        <div className="landing-hero__facts">
          <span><strong>09:00—19:30</strong><small>Every day · Philippine Standard Time</small></span>
          <span><strong>4 branches</strong><small>Bajada · Lanang · Bangkal · Maa</small></span>
        </div>
      </div>

      <div className="landing-hero__media">
        <Image
          src={landingEditorialImages.hero}
          alt="Barracks barber styling a client at Bajada HQ"
          fill
          priority
          loading="eager"
          sizes="(max-width: 760px) 100vw, 56vw"
        />
      </div>

      <div className="landing-hero__collage" aria-label="Barracks shop photography">
        <figure className="landing-hero__collage-item">
          <Image
            src={landingEditorialImages.heroCollageLeft}
            alt="Barracks Bangkal HQ interior"
            fill
            sizes="(max-width: 760px) 100vw, 50vw"
          />
        </figure>
        <figure className="landing-hero__collage-item">
          <Image
            src={landingEditorialImages.heroCollageRight}
            alt="Barracks Bajada HQ interior"
            fill
            sizes="(max-width: 760px) 100vw, 50vw"
          />
        </figure>
      </div>
    </section>
  );
}
