"use client";

import { barbers } from "@/app/data/barbers";
import { bookings } from "@/app/data/bookings";
import { customers } from "@/app/data/customers";
import { revenueByDay } from "@/app/data/reports";
import { transactions } from "@/app/data/transactions";
import type { ViewId } from "@/app/types/domain";
import { formatCurrency } from "@/app/utils/format";
import { downloadCsv } from "@/app/utils/download";
import {
  Avatar,
  Button,
  EmptyState,
  MetricCard,
  PageHeader,
  Panel,
  ProgressBar,
  SectionHeading,
} from "@/app/components/ui";
import { Icon } from "@/app/components/ui/icons";

type AdminDashboardProps = {
  go: (view: ViewId) => void;
  onToast: (message: string) => void;
};

export function AdminDashboard({ go, onToast }: AdminDashboardProps) {
  const totalRevenue = transactions.reduce((total, transaction) => total + transaction.amount, 0);
  const activeBarbers = barbers.filter((barber) => barber.status !== "Off today").length;

  function exportSummary() {
    downloadCsv(
      "barracks-daily-summary.csv",
      ["Metric", "Value"],
      [
        ["Total revenue", formatCurrency(totalRevenue)],
        ["Total customers", String(customers.length)],
        ["Active staff", String(activeBarbers)],
        ["Bookings today", String(bookings.length)],
      ],
    );
    onToast("Daily summary exported");
  }

  return (
    <>
      <PageHeader
        title="Business overview"
        action={
          <Button variant="secondary" icon="download" onClick={exportSummary}>
            Export summary
          </Button>
        }
      />
      <div className="metrics-grid metrics-grid--four metrics-grid--grouped">
        <MetricCard
          label="Total revenue"
          value={formatCurrency(totalRevenue)}
          icon="wallet"
          accent="green"
        />
        <MetricCard
          label="Total customers"
          value={String(customers.length)}
          icon="users"
          accent="blue"
        />
        <MetricCard
          label="Active staff"
          value={String(activeBarbers)}
          icon="briefcase"
          accent="violet"
        />
        <MetricCard
          label="Bookings today"
          value={String(bookings.length)}
          icon="calendar"
          accent="amber"
        />
      </div>

      <div className="dashboard-grid dashboard-grid--wide">
        <Panel className="revenue-overview">
          <SectionHeading
            title="Revenue overview"
            action={
              <select className="table-select" defaultValue="This week">
                <option>This week</option>
                <option>Last week</option>
              </select>
            }
          />
          <div className="revenue-chart">
            <div className="chart-axis">
              <span>$700</span>
              <span>$500</span>
              <span>$300</span>
              <span>$100</span>
              <span>$0</span>
            </div>
            <div className="chart-columns">
              {revenueByDay.length ? revenueByDay.map((day) => (
                <div className="chart-column" key={day.day}>
                  <div className="chart-column__bar-wrap">
                    <span
                      className={
                        "chart-column__bar " +
                        (day.day === "Fri" ? "is-muted" : "")
                      }
                      style={{ height: Math.max(day.value / 7, 4) + "%" }}
                    >
                      <b>{day.value ? formatCurrency(day.value) : ""}</b>
                    </span>
                  </div>
                  <small>{day.day}</small>
                </div>
              )) : (
                <div className="chart-empty">
                  <EmptyState
                    title="No revenue data"
                    description="Revenue trends will appear when transactions are connected."
                  />
                </div>
              )}
            </div>
          </div>
        </Panel>

        <Panel className="barber-performance">
          <SectionHeading
            title="Barber performance"
            action={
              <button
                className="link-button"
                type="button"
                onClick={() => go("barbers")}
              >
                View all <Icon name="arrowRight" size={14} />
              </button>
            }
          />
          <div className="performance-list">
            {barbers.length ? barbers.slice(0, 4).map((barber) => (
              <div className="performance-row" key={barber.id}>
                <div className="performance-row__head">
                  <span>
                    <Avatar
                      initials={barber.initials}
                      tone={barber.tone}
                      size="sm"
                    />
                    <strong>{barber.name}</strong>
                  </span>
                  <strong>{formatCurrency(barber.revenue)}</strong>
                </div>
                <ProgressBar
                  value={barbers.length ? (barber.revenue / Math.max(...barbers.map((item) => item.revenue), 1)) * 100 : 0}
                  tone={barber.tone}
                />
              </div>
            )) : <EmptyState title="No barber data" description="Barber performance will appear when the roster is connected." />}
          </div>
        </Panel>
      </div>

      <div className="management-shortcuts">
        <button type="button" onClick={() => go("staff-management")}>
          <span className="shortcut-icon shortcut-icon--blue">
            <Icon name="users" size={18} />
          </span>
          <span>
            <strong>Staff management</strong>
          </span>
          <Icon name="arrowRight" size={16} />
        </button>
        <button type="button" onClick={() => go("services")}>
          <span className="shortcut-icon shortcut-icon--green">
            <Icon name="briefcase" size={18} />
          </span>
          <span>
            <strong>Services</strong>
          </span>
          <Icon name="arrowRight" size={16} />
        </button>
        <button type="button" onClick={() => go("reports")}>
          <span className="shortcut-icon shortcut-icon--violet">
            <Icon name="chart" size={18} />
          </span>
          <span>
            <strong>Reports</strong>
          </span>
          <Icon name="arrowRight" size={16} />
        </button>
        <button type="button" onClick={() => go("admin-inventory")}>
          <span className="shortcut-icon shortcut-icon--red">
            <Icon name="box" size={18} />
          </span>
          <span>
            <strong>Inventory</strong>
          </span>
          <Icon name="arrowRight" size={16} />
        </button>
      </div>

      <div className="dashboard-lower-grid">
        <Panel>
          <SectionHeading title="Today’s activity" />
          <EmptyState title="No activity yet" description="Activity will appear when operational data is connected." />
        </Panel>
      </div>
    </>
  );
}
