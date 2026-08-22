"use client";

import {
  useMemo,
  useState,
  type Dispatch,
  type FormEvent,
  type SetStateAction,
} from "react";
import { barbers } from "@/app/data/barbers";
import { customers } from "@/app/data/customers";
import { services } from "@/app/data/services";
import type { QueueEntry } from "@/app/types/domain";
import { createInitials, formatCurrency } from "@/app/utils/format";
import {
  Avatar,
  Badge,
  Button,
  MetricCard,
  Modal,
  PageHeader,
  Panel,
  SectionHeading,
  SelectField,
} from "@/app/components/ui";
import { Icon } from "@/app/components/ui/icons";

type QueuePageProps = {
  queue: QueueEntry[];
  setQueue: Dispatch<SetStateAction<QueueEntry[]>>;
  onToast: (message: string) => void;
};

export function QueuePage({ queue, setQueue, onToast }: QueuePageProps) {
  const [addOpen, setAddOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [actionEntry, setActionEntry] = useState<QueueEntry | null>(null);
  const [commissionOpen, setCommissionOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("All statuses");
  const [draft, setDraft] = useState({
    customer: customers[0].name,
    service: services[0].name,
    barber: "Unassigned",
    status: "Waiting" as QueueEntry["status"],
  });

  const visibleQueue = useMemo(
    () =>
      queue.filter(
        (entry) =>
          statusFilter === "All statuses" || entry.status === statusFilter,
      ),
    [queue, statusFilter],
  );

  const averageWait = queue.length
    ? Math.round(
        queue.reduce(
          (total, entry) => total + Number.parseInt(entry.wait, 10),
          0,
        ) / queue.length,
      )
    : 0;

  function addToQueue(event: FormEvent) {
    event.preventDefault();
    const customer = customers.find((item) => item.name === draft.customer);
    const nextId = Math.max(0, ...queue.map((item) => item.id)) + 1;
    const created: QueueEntry = {
      id: nextId,
      customer: draft.customer,
      initials: createInitials(draft.customer),
      service: draft.service,
      barber: draft.barber,
      status: draft.status,
      wait: "0m",
      joined: new Date().toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      }),
      tone: customer?.tone ?? "slate",
    };
    setQueue((items) => [...items, created]);
    setAddOpen(false);
    onToast(created.customer + " added to the queue");
  }

  function updateStatus(id: number, status: QueueEntry["status"]) {
    setQueue((items) =>
      items.map((item) => (item.id === id ? { ...item, status } : item)),
    );
    onToast("Queue status updated to " + status.toLowerCase());
    setActionEntry(null);
  }

  function assignBarber(id: number, barber: string) {
    setQueue((items) =>
      items.map((item) => (item.id === id ? { ...item, barber } : item)),
    );
    onToast(
      barber === "Unassigned"
        ? "Barber assignment cleared"
        : barber + " assigned to the queue",
    );
  }

  function removeFromQueue() {
    if (!actionEntry) return;
    setQueue((items) => items.filter((item) => item.id !== actionEntry.id));
    onToast(actionEntry.customer + " removed from the queue");
    setActionEntry(null);
  }

  return (
    <>
      <PageHeader
        title="Queue management"
        action={
          <Button icon="plus" onClick={() => setAddOpen(true)}>
            Add to queue
          </Button>
        }
      />
      <div className="metrics-grid metrics-grid--three">
        <MetricCard
          label="Total in queue"
          value={String(queue.length)}
          icon="queue"
          accent="blue"
        />
        <MetricCard
          label="Being served"
          value={String(
            queue.filter((item) => item.status === "In chair").length,
          )}
          change="Chair 04 active"
          icon="scissors"
          accent="amber"
          changeTone="warning"
        />
        <MetricCard
          label="Average wait"
          value={averageWait + "m"}
          icon="clock"
          accent="green"
        />
      </div>

      <Panel className="queue-panel">
        <SectionHeading
          title="Current queue"
          action={
            <div className="panel-toolbar">
              <Button
                variant="secondary"
                size="sm"
                icon="filter"
                onClick={() => setFilterOpen(true)}
              >
                Filter
              </Button>
              <Button
                variant="ghost"
                size="sm"
                icon="refresh"
                onClick={() => {
                  setQueue((items) => [...items]);
                  onToast("Queue refreshed");
                }}
              >
                Refresh
              </Button>
            </div>
          }
        />
        <div className="queue-table">
          <div className="queue-table__head">
            <span>#</span>
            <span>Customer</span>
            <span>Service</span>
            <span>Assigned barber</span>
            <span>Status</span>
            <span>Wait</span>
            <span>Action</span>
          </div>
          {visibleQueue.map((entry) => (
            <div
              className={
                "queue-table__row " +
                (entry.status === "In chair" ? "is-active" : "")
              }
              key={entry.id}
            >
              <span className="queue-table__number">
                {String(entry.id).padStart(2, "0")}
              </span>
              <span className="table-person">
                <Avatar initials={entry.initials} tone={entry.tone} size="sm" />
                <span>
                  <strong>{entry.customer}</strong>
                  <small>Joined {entry.joined}</small>
                </span>
              </span>
              <span>
                <strong>{entry.service}</strong>
                <small>Walk-in</small>
              </span>
              <span>
                <select
                  className="table-select"
                  value={entry.barber}
                  onChange={(event) =>
                    assignBarber(entry.id, event.target.value)
                  }
                >
                  <option>Unassigned</option>
                  {barbers
                    .filter((barber) => barber.status !== "Off today")
                    .map((barber) => (
                      <option key={barber.id}>{barber.name}</option>
                    ))}
                </select>
              </span>
              <span>
                <Badge
                  tone={
                    entry.status === "In chair"
                      ? "info"
                      : entry.status === "Ready"
                        ? "success"
                        : "neutral"
                  }
                >
                  {entry.status}
                </Badge>
              </span>
              <span className="queue-table__wait">{entry.wait}</span>
              <span className="row-actions">
                {entry.status !== "In chair" && (
                  <button
                    className="row-action row-action--primary"
                    type="button"
                    onClick={() => updateStatus(entry.id, "In chair")}
                  >
                    Start chair
                  </button>
                )}
                <button
                  className="icon-button icon-button--small"
                  type="button"
                  aria-label={"More actions for " + entry.customer}
                  onClick={() => setActionEntry(entry)}
                >
                  <Icon name="more" size={16} />
                </button>
              </span>
            </div>
          ))}
        </div>
      </Panel>

      <div className="queue-bottom-grid">
        <Panel>
          <SectionHeading title="Barber availability" />
          <div className="barber-status-grid">
            {barbers.slice(0, 3).map((barber) => (
              <div className="barber-status-card" key={barber.id}>
                <div className="barber-status-card__head">
                  <Avatar
                    initials={barber.initials}
                    tone={barber.tone}
                    size="md"
                  />
                  <Badge
                    tone={barber.status === "On floor" ? "success" : "warning"}
                  >
                    {barber.status}
                  </Badge>
                </div>
                <strong>{barber.name}</strong>
                <span>{barber.specialty}</span>
                <div className="barber-status-card__stats">
                  <span>
                    <small>Served</small>
                    <strong>{barber.services}</strong>
                  </span>
                  <span>
                    <small>Revenue</small>
                    <strong>{formatCurrency(barber.revenue)}</strong>
                  </span>
                  <span>
                    <small>Commission</small>
                    <strong>{formatCurrency(barber.commission)}</strong>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel className="commission-panel">
          <SectionHeading
            title="Today’s commission"
            action={
              <button
                className="link-button"
                type="button"
                onClick={() => setCommissionOpen(true)}
              >
                View details <Icon name="arrowRight" size={14} />
              </button>
            }
          />
          <div className="commission-table">
            <div>
              <span>Barber</span>
              <span>Services</span>
              <span>Revenue</span>
              <span>Commission</span>
            </div>
            {barbers.slice(0, 3).map((barber) => (
              <div key={barber.id}>
                <span className="table-person">
                  <Avatar
                    initials={barber.initials}
                    tone={barber.tone}
                    size="sm"
                  />
                  {barber.name}
                </span>
                <span>{barber.services}</span>
                <strong>{formatCurrency(barber.revenue)}</strong>
                <strong className="text-amber">
                  {formatCurrency(barber.commission)}
                </strong>
              </div>
            ))}
            <div className="commission-total">
              <strong>Total</strong>
              <strong>105</strong>
              <strong>{formatCurrency(2485)}</strong>
              <strong className="text-amber">{formatCurrency(745.5)}</strong>
            </div>
          </div>
        </Panel>
      </div>

      <Modal
        open={addOpen}
        title="Add to queue"
        description="Create a walk-in entry and assign its initial status."
        onClose={() => setAddOpen(false)}
      >
        <form className="modal-form" onSubmit={addToQueue}>
          <SelectField
            label="Customer"
            value={draft.customer}
            onChange={(event) =>
              setDraft({ ...draft, customer: event.target.value })
            }
          >
            {customers.map((customer) => (
              <option key={customer.id}>{customer.name}</option>
            ))}
          </SelectField>
          <SelectField
            label="Service"
            value={draft.service}
            onChange={(event) =>
              setDraft({ ...draft, service: event.target.value })
            }
          >
            {services
              .filter((service) => service.active)
              .map((service) => (
                <option key={service.id}>{service.name}</option>
              ))}
          </SelectField>
          <SelectField
            label="Barber"
            value={draft.barber}
            onChange={(event) =>
              setDraft({ ...draft, barber: event.target.value })
            }
          >
            <option>Unassigned</option>
            {barbers
              .filter((barber) => barber.status !== "Off today")
              .map((barber) => (
                <option key={barber.id}>{barber.name}</option>
              ))}
          </SelectField>
          <SelectField
            label="Status"
            value={draft.status}
            onChange={(event) =>
              setDraft({
                ...draft,
                status: event.target.value as QueueEntry["status"],
              })
            }
          >
            <option>Waiting</option>
            <option>Ready</option>
            <option>In chair</option>
          </SelectField>
          <div className="modal-actions">
            <Button
              variant="secondary"
              type="button"
              onClick={() => setAddOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" icon="plus">
              Add customer
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={filterOpen}
        title="Filter queue"
        onClose={() => setFilterOpen(false)}
      >
        <div className="modal-form">
          <SelectField
            label="Status"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option>All statuses</option>
            <option>Waiting</option>
            <option>Ready</option>
            <option>In chair</option>
          </SelectField>
          <div className="modal-actions">
            <Button type="button" onClick={() => setFilterOpen(false)}>
              Apply filter
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(actionEntry)}
        title={actionEntry ? "Queue actions" : "Queue actions"}
        description={actionEntry?.customer}
        onClose={() => setActionEntry(null)}
      >
        {actionEntry && (
          <div className="modal-form">
            <div className="detail-modal__row">
              <span>Current status</span>
              <Badge
                tone={actionEntry.status === "In chair" ? "info" : "neutral"}
              >
                {actionEntry.status}
              </Badge>
            </div>
            <div className="modal-actions modal-actions--stack">
              {actionEntry.status !== "In chair" && (
                <Button
                  type="button"
                  onClick={() => updateStatus(actionEntry.id, "In chair")}
                >
                  Start chair
                </Button>
              )}
              {actionEntry.status !== "Ready" && (
                <Button
                  variant="secondary"
                  type="button"
                  onClick={() => updateStatus(actionEntry.id, "Ready")}
                >
                  Mark ready
                </Button>
              )}
              <Button variant="danger" type="button" onClick={removeFromQueue}>
                Remove from queue
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={commissionOpen}
        title="Today’s commission"
        description="Commission totals by barber for today."
        onClose={() => setCommissionOpen(false)}
        width="lg"
      >
        <div className="detail-modal">
          {barbers.map((barber) => (
            <div className="detail-modal__row" key={barber.id}>
              <span className="table-person">
                <Avatar
                  initials={barber.initials}
                  tone={barber.tone}
                  size="sm"
                />
                <strong>{barber.name}</strong>
              </span>
              <span>{barber.services} services</span>
              <strong className="text-amber">
                {formatCurrency(barber.commission)}
              </strong>
            </div>
          ))}
          <div className="modal-actions">
            <Button type="button" onClick={() => setCommissionOpen(false)}>
              Done
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
