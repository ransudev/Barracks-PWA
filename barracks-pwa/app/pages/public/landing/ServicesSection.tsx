"use client";

import { useState } from "react";
import { Button } from "@/app/components/ui";
import { Icon } from "@/app/components/ui/icons";
import { landingServices, type LandingMenuItem, type LandingServiceSection } from "@/app/data/landing";
import type { ViewId } from "@/app/types/domain";

function MenuItem({ item }: { item: LandingMenuItem }) {
  return (
    <div className="service-card__item">
      <div className="service-card__item-name">
        <strong>{item.name}</strong>
        {item.duration ? <small>{item.duration}</small> : null}
      </div>
      <div className="service-card__item-prices">
        {item.prices.map((price, index) => (
          <span className="service-card__price" key={`${item.id}-${index}`}>
            {price.label ? <small>{price.label}</small> : null}
            <strong>{price.amount}</strong>
          </span>
        ))}
      </div>
    </div>
  );
}

function MenuRows({ service }: { service: LandingServiceSection }) {
  if (service.groups) {
    return service.groups.map((group) => (
      <section className="service-card__group" key={group.id}>
        <h4>{group.name}</h4>
        <div>{group.items.map((item) => <MenuItem item={item} key={item.id} />)}</div>
      </section>
    ));
  }

  return service.items?.map((item) => <MenuItem item={item} key={item.id} />);
}

export function ServicesSection({ go }: { go: (view: ViewId) => void }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeService = landingServices[activeIndex];

  const moveTo = (index: number) => {
    setActiveIndex((index + landingServices.length) % landingServices.length);
  };

  return (
    <section className="landing-services" id="services">
      <div className="landing-section-head">
        <div>
          <h2>Services</h2>
        </div>
      </div>
      <div className="service-slideshow" aria-label="Barracks services slideshow">
        <div className="service-slideshow__toolbar">
          <div className="service-slideshow__controls">
            <button type="button" aria-label="Previous service" onClick={() => moveTo(activeIndex - 1)}>
              <Icon name="chevronLeft" size={16} />
            </button>
            <button type="button" aria-label="Next service" onClick={() => moveTo(activeIndex + 1)}>
              <Icon name="chevronRight" size={16} />
            </button>
          </div>
        </div>

        <div className="service-slideshow__viewport">
          <article
            className="service-card service-card--menu service-card--slide-in"
            key={activeService.id}
            aria-label={`${activeService.name}, slide ${activeIndex + 1} of ${landingServices.length}`}
            role="group"
          >
            <div className="service-card__body">
              <div>
                <div className="service-card__heading">
                  <h3>{activeService.name}</h3>
                  <small>{activeService.duration}</small>
                </div>
                <p>{activeService.description}</p>
                <div className="service-card__menu">{MenuRows({ service: activeService })}</div>
              </div>
              <div className="service-card__footer">
                <Button variant="secondary" size="sm" iconAfter="arrowRight" onClick={() => go("customer-dashboard")}>
                  Book Service
                </Button>
              </div>
            </div>
          </article>
        </div>

        <div className="service-slideshow__indicators" aria-label="Choose a service category">
          {landingServices.map((service, index) => (
            <button
              type="button"
              className={index === activeIndex ? "is-active" : ""}
              aria-label={`Show ${service.name}`}
              aria-current={index === activeIndex ? "step" : undefined}
              onClick={() => moveTo(index)}
              key={service.id}
            >
              <span aria-hidden="true" />
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
