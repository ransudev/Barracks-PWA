"use client";

import { barbers } from "@/app/data/barbers";
import { bookings } from "@/app/data/bookings";
import { queueEntries } from "@/app/data/queue";
import { transactions } from "@/app/data/transactions";
import type { ViewId } from "@/app/types/domain";
import { formatCurrency } from "@/app/utils/format";
import {
  Avatar,
  Badge,
  Button,
  EmptyState,
  MetricCard,
  PageHeader,
  Panel,
  SectionHeading,
} from "@/app/components/ui";
import { Icon } from "@/app/components/ui/icons";

type StaffDashboardProps = {
  go: (view: ViewId) => void;
};

export function StaffDashboard({ go }: StaffDashboardProps) {
  const revenue = transactions.reduce((total, transaction) => total + transaction.amount, 0);

  return (
    <>
      <PageHeader
        title="Shop floor dashboard"
        action={
          <Button icon="plus" onClick={() => go("queue")}>
            Add to queue
          </Button>
        }
      />
      <div className="metrics-grid metrics-grid--four">
        <MetricCard
          label="Customers in queue"
          value={String(queueEntries.length)}
          icon="queue"
          accent="blue"
        />
        <MetricCard
          label="Today’s bookings"
          value={String(bookings.length)}
          icon="calendar"
          accent="violet"
        />
        <MetricCard
          label="Active barbers"
          value={String(barbers.filter((barber) => barber.status !== "Off today").length)}
          icon="scissors"
          accent="green"
        />
        <MetricCard
          label="Today’s revenue"
          value={formatCurrency(revenue)}
          icon="wallet"
          accent="amber"
        />
      </div>

      <div className="dashboard-grid dashboard-grid--wide">
        <Panel className="queue-preview">
          <SectionHeading
            title="Live queue"
            action={
              <button
                className="link-button"
                type="button"
                onClick={() => go("queue")}
              >
                Open queue <Icon name="arrowRight" size={14} />
              </button>
            }
          />
          <div className="queue-preview__list">
            {queueEntries.length ? queueEntries.slice(0, 3).map((entry) => (
              <button
                className="queue-preview__row"
                type="button"
                key={entry.id}
                onClick={() => go("queue")}
              >
                <span className="queue-number">
                  {String(entry.id).padStart(2, "0")}
                </span>
                <Avatar initials={entry.initials} tone={entry.tone} size="sm" />
                <span className="queue-preview__name">
                  <strong>{entry.customer}</strong>
                  <small>{entry.service}</small>
                </span>
                <span
                  className={
                    "queue-stage queue-stage--" +
                    (entry.status === "In chair"
                      ? "active"
                      : entry.status === "Ready"
                        ? "ready"
                        : "waiting")
                  }
                >
                  {entry.status}
                </span>
                <span className="queue-preview__wait">{entry.wait}</span>
                <Icon name="chevronRight" size={15} />
              </button>
            )) : <EmptyState title="Queue is empty" description="Queue entries will appear when connected to the backend." />}
          </div>
        </Panel>

        <Panel className="schedule-preview">
          <SectionHeading
            title="Next on the book"
            action={
              <button
                className="link-button"
                type="button"
                onClick={() => go("bookings")}
              >
                All bookings <Icon name="arrowRight" size={14} />
              </button>
            }
          />
          <div className="schedule-list">
            {bookings.length ? bookings
              .filter((booking) => booking.status === "Upcoming")
              .slice(0, 3)
              .map((booking, index) => (
                <button
                  className={
                    "schedule-row " + (index === 0 ? "is-priority" : "")
                  }
                  type="button"
                  key={booking.id}
                  onClick={() => go("bookings")}
                >
                  <span className="schedule-row__time">
                    <strong>{booking.time}</strong>
                    <small>{booking.meridiem}</small>
                  </span>
                  <span className="schedule-row__line" />
                  <span>
                    <strong>{booking.customer}</strong>
                    <small>
                      {booking.service} · {booking.barber}
                    </small>
                  </span>
                  <span className="schedule-row__price">
                    {formatCurrency(booking.price)}
                  </span>
                </button>
              )) : <EmptyState title="No upcoming bookings" description="Bookings will appear when connected to the backend." />}
          </div>
        </Panel>
      </div>

      <div className="quick-actions">
        <button type="button" onClick={() => go("customers")}>
          <span className="quick-actions__icon quick-actions__icon--blue">
            <Icon name="userPlus" size={18} />
          </span>
          <span>
            <strong>Register customer</strong>
          </span>
          <Icon name="arrowRight" size={16} />
        </button>
        <button type="button" onClick={() => go("payment")}>
          <span className="quick-actions__icon quick-actions__icon--green">
            <Icon name="wallet" size={18} />
          </span>
          <span>
            <strong>Process payment</strong>
          </span>
          <Icon name="arrowRight" size={16} />
        </button>
        <button type="button" onClick={() => go("inventory")}>
          <span className="quick-actions__icon quick-actions__icon--red">
            <Icon name="box" size={18} />
          </span>
          <span>
            <strong>Inventory alert</strong>
          </span>
          <Icon name="arrowRight" size={16} />
        </button>
      </div>

      <div className="dashboard-lower-grid">
        <Panel>
          <SectionHeading title="Barber availability" />
          <div className="availability-list">
            {barbers.length ? barbers.slice(0, 3).map((barber) => (
              <div className="availability-row" key={barber.id}>
                <Avatar
                  initials={barber.initials}
                  tone={barber.tone}
                  size="sm"
                />
                <span>
                  <strong>{barber.name}</strong>
                  <small>{barber.specialty}</small>
                </span>
                <Badge
                  tone={barber.status === "On floor" ? "success" : "warning"}
                >
                  {barber.status}
                </Badge>
              </div>
            )) : <EmptyState title="No barber profiles" description="Barber availability will appear when the roster is connected." />}
          </div>
        </Panel>
      </div>
    </>
  );
}
