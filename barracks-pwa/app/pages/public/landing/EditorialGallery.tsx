import Image from "next/image";
import { landingEditorialImages } from "@/app/data/landing";

export function EditorialGallery() {
  return (
    <section className="landing-editorial" aria-label="Inside Barracks">
      <div className="editorial-gallery">
        <figure className="editorial-gallery__image editorial-gallery__image--tools">
          <Image src={landingEditorialImages.tools} alt="Close-up of barber tools" fill sizes="(max-width: 760px) 100vw, 34vw" />
        </figure>
        <figure className="editorial-gallery__image editorial-gallery__image--detail">
          <Image src={landingEditorialImages.collageDetail} alt="Close-up of a barber finishing a haircut" fill sizes="(max-width: 760px) 100vw, 34vw" />
        </figure>
      </div>
    </section>
  );
}
