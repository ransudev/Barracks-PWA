"use client";

import { useState, type FormEvent } from "react";
import { barbers as initialBarbers } from "@/app/data/barbers";
import { bookings } from "@/app/data/bookings";
import type { Barber } from "@/app/types/domain";
import { createInitials, createSlug, formatCurrency } from "@/app/utils/format";
import { usePersistentState } from "@/app/hooks/usePersistentState";
import {
  Avatar,
  Badge,
  Button,
  EmptyState,
  MetricCard,
  Modal,
  PageHeader,
  Panel,
  SectionHeading,
  SelectField,
  TextField,
} from "@/app/components/ui";
import { Icon } from "@/app/components/ui/icons";

export function BarbersManagement({
  onToast,
}: {
  onToast: (message: string) => void;
}) {
  const [items, setItems] = usePersistentState<Barber[]>(
    "barracks-barbers-v2",
    initialBarbers,
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Barber | null>(null);
  const [scheduleBarber, setScheduleBarber] = useState<Barber | null>(null);
  const [commissionModalOpen, setCommissionModalOpen] = useState(false);
  const [commissionRate, setCommissionRate] = useState("");
  const [newBarber, setNewBarber] = useState({ name: "", specialty: "" });

  function addBarber(event: FormEvent) {
    event.preventDefault();
    if (!newBarber.name.trim()) {
      onToast("Add a barber name first");
      return;
    }

    const initials = createInitials(newBarber.name);
    const created: Barber = {
      id: createSlug(newBarber.name),
      name: newBarber.name,
      initials,
      specialty: newBarber.specialty || "Cuts + styling",
      status: "On floor",
      tone: "blue",
      services: 0,
      revenue: 0,
      commission: 0,
      rating: 0,
      customers: 0,
      memberSince: new Date().toLocaleDateString(undefined, { month: "short", year: "numeric" }),
    };

    setItems((list) => [...list, created]);
    setNewBarber({ name: "", specialty: "" });
    setModalOpen(false);
    onToast(created.name + " added to the barber roster");
  }

  function saveBarber(event: FormEvent) {
    event.preventDefault();
    if (!editing?.name.trim()) {
      onToast("Add a barber name first");
      return;
    }

    setItems((list) =>
      list.map((item) =>
        item.id === editing.id
          ? {
              ...item,
              name: editing.name.trim(),
              initials: createInitials(editing.name),
              specialty: editing.specialty.trim() || "Cuts + styling",
              status: editing.status,
            }
          : item,
      ),
    );
    onToast(editing.name + " updated");
    setEditing(null);
  }

  function saveCommission(event: FormEvent) {
    event.preventDefault();
    const rate = Number(commissionRate);
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
      onToast("Enter a commission rate between 0 and 100");
      return;
    }
    onToast("Commission rate updated to " + rate + "%");
    setCommissionModalOpen(false);
  }

  return (
    <>
      <PageHeader
        title="Barber management"
        action={
          <div className="page-header__actions">
            <Button
              variant="secondary"
              icon="sliders"
              onClick={() => setCommissionModalOpen(true)}
            >
              Set commission rate
            </Button>
            <Button icon="plus" onClick={() => setModalOpen(true)}>
              Add barber
            </Button>
          </div>
        }
      />
      <div className="metrics-grid metrics-grid--four">
        <MetricCard
          label="Total barbers"
          value={String(items.length)}
          icon="scissors"
          accent="blue"
        />
        <MetricCard
          label="This week’s revenue"
          value={formatCurrency(items.reduce((total, barber) => total + barber.revenue, 0))}
          icon="wallet"
          accent="green"
        />
        <MetricCard
          label="Commission rate"
          value={commissionRate ? commissionRate + "%" : "—"}
          icon="spark"
          accent="amber"
        />
        <MetricCard
          label="Total commission"
          value={formatCurrency(items.reduce((total, barber) => total + barber.commission, 0))}
          icon="chart"
          accent="violet"
        />
      </div>

      <Panel className="barber-management-panel">
        <SectionHeading
          title="Barbers"
          action={
            <SelectField value="This week" onChange={() => undefined}>
              <option>This week</option>
              <option>All time</option>
            </SelectField>
          }
        />
        <div className="barber-management-list">
          {items.length ? items.map((barber) => (
            <article className="barber-management-card" key={barber.id}>
              <div className="barber-management-card__intro">
                <Avatar
                  initials={barber.initials}
                  tone={barber.tone}
                  size="lg"
                />
                <div>
                  <h3>{barber.name}</h3>
                  <p>{barber.specialty}</p>
                  <small>Member since {barber.memberSince}</small>
                </div>
                <Badge
                  tone={
                    barber.status === "On floor"
                      ? "success"
                      : barber.status === "On break"
                        ? "warning"
                        : "neutral"
                  }
                >
                  {barber.status}
                </Badge>
              </div>
              <div className="barber-management-card__stats">
                <span>
                  <small>Services done</small>
                  <strong>{barber.services}</strong>
                </span>
                <span>
                  <small>Revenue</small>
                  <strong className="text-green">
                    {formatCurrency(barber.revenue)}
                  </strong>
                </span>
                <span>
                  <small>Commission</small>
                  <strong className="text-amber">
                    {formatCurrency(barber.commission)}
                  </strong>
                </span>
                <span>
                  <small>Rating</small>
                  <strong>
                    {barber.rating ? barber.rating + " ★" : "New"}
                  </strong>
                </span>
              </div>
              <div className="barber-management-card__actions">
                <button
                  className="row-action"
                  type="button"
                  onClick={() => setEditing({ ...barber })}
                >
                  <Icon name="edit" size={14} />
                  Edit profile
                </button>
                <button
                  className="row-action"
                  type="button"
                  onClick={() => setScheduleBarber(barber)}
                >
                  View schedule <Icon name="arrowRight" size={14} />
                </button>
              </div>
            </article>
          )) : (
            <EmptyState
              title="No barbers yet"
              description="Barber profiles will appear when the roster is connected."
            />
          )}
        </div>
      </Panel>

      <Modal
        open={modalOpen}
        title="Add barber"
        description="Add a new craft profile to the roster."
        onClose={() => setModalOpen(false)}
      >
        <form className="modal-form" onSubmit={addBarber}>
          <TextField
            label="Barber name"
            value={newBarber.name}
            onChange={(event) =>
              setNewBarber({ ...newBarber, name: event.target.value })
            }
            placeholder="e.g. Sofia Navarro"
          />
          <TextField
            label="Specialty"
            value={newBarber.specialty}
            onChange={(event) =>
              setNewBarber({ ...newBarber, specialty: event.target.value })
            }
            placeholder="e.g. Classic cuts + shaves"
          />
          <div className="modal-actions">
            <Button
              variant="secondary"
              type="button"
              onClick={() => setModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" icon="plus">
              Add barber
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(editing)}
        title="Edit barber profile"
        onClose={() => setEditing(null)}
      >
        {editing && (
          <form className="modal-form" onSubmit={saveBarber}>
            <TextField
              label="Barber name"
              value={editing.name}
              onChange={(event) =>
                setEditing({ ...editing, name: event.target.value })
              }
            />
            <TextField
              label="Specialty"
              value={editing.specialty}
              onChange={(event) =>
                setEditing({ ...editing, specialty: event.target.value })
              }
            />
            <SelectField
              label="Status"
              value={editing.status}
              onChange={(event) =>
                setEditing({
                  ...editing,
                  status: event.target.value as Barber["status"],
                })
              }
            >
              <option>On floor</option>
              <option>On break</option>
              <option>Off today</option>
            </SelectField>
            <div className="modal-actions">
              <Button
                variant="secondary"
                type="button"
                onClick={() => setEditing(null)}
              >
                Cancel
              </Button>
              <Button type="submit" icon="check">
                Save changes
              </Button>
            </div>
          </form>
        )}
      </Modal>

      <Modal
        open={commissionModalOpen}
        title="Commission rate"
        onClose={() => setCommissionModalOpen(false)}
      >
        <form className="modal-form" onSubmit={saveCommission}>
          <TextField
            label="Default commission rate"
            type="number"
            min="0"
            max="100"
            step="0.5"
            value={commissionRate}
            onChange={(event) => setCommissionRate(event.target.value)}
          />
          <div className="modal-actions">
            <Button
              variant="secondary"
              type="button"
              onClick={() => setCommissionModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" icon="check">
              Save rate
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(scheduleBarber)}
        title={scheduleBarber ? scheduleBarber.name + " schedule" : "Schedule"}
        onClose={() => setScheduleBarber(null)}
      >
        <div className="detail-modal">
          {bookings
            .filter((booking) => booking.barber === scheduleBarber?.name)
            .map((booking) => (
              <div className="detail-modal__row" key={booking.id}>
                <strong>
                  {booking.time} {booking.meridiem}
                </strong>
                <span>
                  {booking.customer} · {booking.service}
                </span>
                <Badge
                  tone={
                    booking.status === "Completed"
                      ? "success"
                      : booking.status === "Upcoming"
                        ? "warning"
                        : "danger"
                  }
                >
                  {booking.status}
                </Badge>
              </div>
            ))}
          {!bookings.some(
            (booking) => booking.barber === scheduleBarber?.name,
          ) && (
            <p className="modal-empty">
              No bookings scheduled for this barber.
            </p>
          )}
        </div>
      </Modal>
    </>
  );
}
