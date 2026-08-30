import { Logo } from "@/app/components/ui";
import { landingContact, landingHours } from "@/app/data/landing";

export function PublicFooter() {
  return (
    <footer className="public-footer" id="contact">
      <div className="public-footer__main">
        <div className="public-footer__column public-footer__column--social"><span>FOLLOW ALONG</span><a href={landingContact.instagramUrl} target="_blank" rel="noreferrer">Instagram {landingContact.socialHandle}</a><a href={landingContact.facebookUrl} target="_blank" rel="noreferrer">Facebook {landingContact.socialHandle}</a></div>
        <div className="public-footer__brand"><Logo /><p>Premium grooming, homegrown in Davao.<br />Craftsmanship. Community. Culture.</p></div>
        <div className="public-footer__column public-footer__column--contact"><span>CONTACT</span><a href={`tel:${landingContact.phoneHref}`}>{landingContact.phone}</a><a href={`mailto:${landingContact.email}`}>{landingContact.email}</a><span>{landingContact.hashtag}</span><span>{landingHours.label}</span></div>
      </div>
      <div className="public-footer__bottom"><span>© 2026 Barracks Barbers &amp; Shaves · Davao City, Philippines</span><span>Booking: {landingContact.phone} · 10-minute grace period · {landingContact.hashtag}</span></div>
    </footer>
  );
}
