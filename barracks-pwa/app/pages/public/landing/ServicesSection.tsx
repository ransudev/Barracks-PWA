import Image from "next/image";
import { Button } from "@/app/components/ui";
import { landingServices } from "@/app/data/landing";
import type { ViewId } from "@/app/types/domain";

export function ServicesSection({ go }: { go: (view: ViewId) => void }) {
  return (
    <section className="landing-services" id="services">
      <div className="landing-section-head">
        <div>
          <h2>Services</h2>
        </div>
        <p>Every appointment starts with a consultation<br />and ends with a complete grooming finish.</p>
      </div>
      <div className="service-card-grid">
        {landingServices.map((service) => (
          <article className="service-card" key={service.id}>
            <div className="service-card__image">
              <Image src={service.image} alt={`${service.name} at Barracks`} fill sizes="(max-width: 760px) 100vw, 33vw" />
              <span>{service.number}</span>
              <span className="service-card__duration">{service.duration}</span>
            </div>
            <div className="service-card__body">
              <div><h3>{service.name}</h3><p>{service.description}</p></div>
              <div className="service-card__footer">
                <span className="service-card__pricing"><strong>{service.price}</strong><small>{service.priceNote}</small></span>
                <Button variant="secondary" size="sm" iconAfter="arrowRight" onClick={() => go("customer")}>
                  Book Service
                </Button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
