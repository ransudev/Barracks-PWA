import Image from "next/image";
import { Button } from "@/app/components/ui";
import { Icon } from "@/app/components/ui/icons";
import {
  landingBarberImages,
  landingBarbers,
  landingEditorialImages,
} from "@/app/data/landing";
import type { ViewId } from "@/app/types/domain";

const featuredBarbers = [landingBarbers[0], landingBarbers[4], landingBarbers[9]];

function imageForBarber(id: string) {
  return landingBarberImages[id] ?? landingEditorialImages.detail;
}

export function BarbersSection({ go }: { go: (view: ViewId) => void }) {
  const [featuredBarber, ...otherBarbers] = featuredBarbers;

  return (
    <section className="landing-barbers" id="barbers">
      <div className="landing-section-head">
        <div>
          <h2>Our Barbers</h2>
        </div>
        <p>Meet the barbers behind the Barracks chair.<br />Book by branch, role, and current tier.</p>
      </div>
      <div className="barber-editorial-grid">
        <article className="barber-feature">
          <div className="barber-feature__image">
            <Image src={imageForBarber(featuredBarber.id)} alt={`${featuredBarber.name} portrait placeholder`} fill sizes="(max-width: 760px) 100vw, 44vw" />
            <span>01 / {featuredBarber.branch}</span>
          </div>
          <div className="barber-feature__meta">
            <div>
              <h3>{featuredBarber.name}</h3>
              <p>{featuredBarber.role} · {featuredBarber.price} · 45 min</p>
              <span className="barber-feature__dayoff">Day off: {featuredBarber.dayOff}</span>
            </div>
            <Button variant="ghost" size="sm" iconAfter="arrowRight" onClick={() => go("customer")}>
              Book with {featuredBarber.name}
            </Button>
          </div>
        </article>
        <div className="barber-list">
          {otherBarbers.map((barber, index) => (
            <article className="barber-list__item" key={barber.id}>
              <div className="barber-list__image">
                <Image src={imageForBarber(barber.id)} alt={`${barber.name} portrait placeholder`} fill sizes="(max-width: 760px) 30vw, 18vw" />
              </div>
              <div className="barber-list__meta">
                <span className="barber-list__number">0{index + 2}</span>
                <div>
                  <h3>{barber.name}</h3>
                  <p>{barber.role} · {barber.branch}</p>
                  <span className="barber-list__status"><i /> {barber.price} · Day off: {barber.dayOff}</span>
                </div>
                <button type="button" aria-label={`Book with ${barber.name}`} onClick={() => go("customer")}><Icon name="arrowRight" size={17} /></button>
              </div>
            </article>
          ))}
        </div>
      </div>
      <div className="barber-roster-note">
        <Icon name="users" size={16} />
        <span>Showing selected barbers across our branches. Current branch availability is confirmed during booking. Portraits are editorial placeholders pending approved Barracks photography.</span>
        <button type="button" onClick={() => go("customer")}>View booking roster <Icon name="arrowRight" size={14} /></button>
      </div>
    </section>
  );
}
