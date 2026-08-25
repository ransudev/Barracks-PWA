import { Logo } from "@/app/components/ui";
import { Icon } from "@/app/components/ui/icons";
import { landingContact, landingHours } from "@/app/data/landing";
import type { ViewId } from "@/app/types/domain";

export function PublicFooter({ go }: { go: (view: ViewId) => void }) {
  return (
    <footer className="public-footer" id="contact">
      <div className="public-footer__main">
        <div className="public-footer__column public-footer__column--social"><span>FOLLOW ALONG</span><a href={landingContact.instagramUrl} target="_blank" rel="noreferrer">Instagram {landingContact.socialHandle} <Icon name="arrowRight" size={14} /></a><a href={landingContact.facebookUrl} target="_blank" rel="noreferrer">Facebook {landingContact.socialHandle} <Icon name="arrowRight" size={14} /></a></div>
        <div className="public-footer__brand"><Logo /><p>Premium grooming, homegrown in Davao.<br />Craftsmanship. Community. Culture.</p></div>
        <div className="public-footer__column public-footer__column--contact"><span>CONTACT</span><a href={`tel:${landingContact.phoneHref}`}>{landingContact.phone}</a><a href={`mailto:${landingContact.email}`}>{landingContact.email}</a><span>GCash {landingContact.gcash}</span><span>{landingContact.hashtag}</span><span>{landingHours.label}</span><button type="button" onClick={() => go("login")}>Staff login <Icon name="arrowRight" size={14} /></button></div>
      </div>
      <div className="public-footer__bottom"><span>© 2026 Barracks Barbers &amp; Shaves · Davao City, Philippines</span><span>Booking: {landingContact.phone} · 10-minute grace period · {landingContact.hashtag}</span></div>
    </footer>
  );
}
