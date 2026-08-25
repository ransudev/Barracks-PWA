import { Button } from "@/app/components/ui";
import type { ViewId } from "@/app/types/domain";

export function FinalCta({ go }: { go: (view: ViewId) => void }) {
  return (
    <section className="landing-final-cta">
      <div><h2>Ready for your next cut?</h2></div>
      <div className="landing-final-cta__action">
        <p>Check your email for confirmation after booking. Arrive on time; a 10-minute waiting-time extension is provided.</p>
        <Button size="lg" icon="calendar" onClick={() => go("customer")}>Book an Appointment</Button>
      </div>
    </section>
  );
}
