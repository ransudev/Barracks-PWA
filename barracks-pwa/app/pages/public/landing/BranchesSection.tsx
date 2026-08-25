import { Button } from "@/app/components/ui";
import { Icon } from "@/app/components/ui/icons";
import { landingBranches, landingHours } from "@/app/data/landing";
import type { ViewId } from "@/app/types/domain";

export function BranchesSection({ go }: { go: (view: ViewId) => void }) {
  return (
    <section className="landing-branches" id="branches">
      <div className="landing-section-head">
        <div>
          <h2>Four branches across Davao.</h2>
        </div>
        <p>{landingHours.label}<br />{landingHours.timezone}</p>
      </div>
      <div className="branch-grid">
        {landingBranches.map((branch, index) => (
          <article className="branch-card" key={branch.id}>
            <div className="branch-card__top">
              <span>0{index + 1} / HQ</span>
              <Icon name="mapPin" size={16} />
            </div>
            <h3>{branch.name}</h3>
            <p>{branch.address}</p>
            <span className="branch-card__landmark">{branch.landmark}</span>
            <div className="branch-card__meta">
              <span>BARBERS</span>
              <strong>{branch.barbers}</strong>
            </div>
            <div className="branch-card__actions">
              <a href="#contact">View branch <Icon name="arrowRight" size={14} /></a>
              <Button variant="secondary" size="sm" onClick={() => go("customer")}>
                Book here
              </Button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
