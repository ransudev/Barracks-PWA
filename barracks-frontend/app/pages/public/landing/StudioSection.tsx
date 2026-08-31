import Image from "next/image";
import { Icon } from "@/app/components/ui/icons";
import { landingContact, landingEditorialImages, landingHours } from "@/app/data/landing";

export function StudioSection() {
  return (
    <section className="landing-studio" id="about">
      <div className="studio-image">
        <Image src={landingEditorialImages.studio} alt="Barracks barbershop studio interior" fill sizes="(max-width: 760px) 100vw, 50vw" />
        <span className="studio-image__label">BARRACKS / DAVAO</span>
      </div>
      <div className="studio-copy">
        <h2>About Barracks</h2>
        <p>Homegrown in Davao since 2017, Barracks is built for the moments between the rush. Good conversation, skilled hands, and a finish you can feel good about.</p>
        <div className="studio-details">
          <div><span>OPENING HOURS</span><strong>{landingHours.label}</strong></div>
          <div><span>CALL THE SHOP</span><strong><Icon name="phone" size={14} /> {landingContact.phone}</strong></div>
          <div><span>EMAIL</span><strong>{landingContact.email}</strong></div>
        </div>
        <a className="editorial-link" href="#branches">Explore the branches <Icon name="arrowRight" size={15} /></a>
      </div>
    </section>
  );
}
