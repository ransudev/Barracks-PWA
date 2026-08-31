import { Button } from "@/app/components/ui";
import { landingContact } from "@/app/data/landing";
import type { ViewId } from "@/app/types/domain";

export function FinalCta({ go }: { go: (view: ViewId) => void }) {
  return (
    <section className="landing-final-cta">
      <div><h2>Ready for your next cut?</h2></div>
      <div className="landing-final-cta__action">
        <p>
          Book via <span className="landing-final-cta__contact">{landingContact.phone}</span>. Check your email for confirmation after booking. A 10-minute waiting-time extension is provided.
        </p>
        <Button size="lg" icon="calendar" onClick={() => go("customer-booking")}>Book an Appointment</Button>
      </div>
    </section>
  );
}
