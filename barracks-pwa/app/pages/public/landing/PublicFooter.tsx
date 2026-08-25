import { Logo } from "@/app/components/ui";
import { Icon } from "@/app/components/ui/icons";
import { landingContact, landingHours } from "@/app/data/landing";
import type { ViewId } from "@/app/types/domain";

export function PublicFooter({ go }: { go: (view: ViewId) => void }) {
  return (
    <footer className="public-footer" id="contact">
      <div className="public-footer__main">
        <div className="public-footer__column public-footer__column--social"><span>FOLLOW ALONG</span><a href="https://www.instagram.com/barracksdvo" target="_blank" rel="noreferrer">Instagram <Icon name="arrowRight" size={14} /></a><a href="https://www.facebook.com/" target="_blank" rel="noreferrer">Facebook <Icon name="arrowRight" size={14} /></a></div>
        <div className="public-footer__brand"><Logo /><p>Premium grooming, homegrown in Davao.<br />Craftsmanship. Community. Culture.</p></div>
        <div className="public-footer__column public-footer__column--contact"><span>CONTACT</span><a href="tel:+639565426212">{landingContact.phone}</a><a href={`mailto:${landingContact.email}`}>{landingContact.email}</a><span>{landingHours.label}</span><button type="button" onClick={() => go("login")}>Staff login <Icon name="arrowRight" size={14} /></button></div>
      </div>
      <div className="public-footer__bottom"><span>© 2026 Barracks Barbers &amp; Shaves · Davao City, Philippines</span><span>10-minute booking grace period</span></div>
    </footer>
  );
}
