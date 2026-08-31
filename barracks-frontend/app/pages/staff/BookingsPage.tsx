"use client";

import { useMemo, useState } from "react";
import { barbers } from "@/app/data/barbers";
import { bookings as initialBookings } from "@/app/data/bookings";
import { customers } from "@/app/data/customers";
import { services } from "@/app/data/services";
import type { Booking } from "@/app/types/domain";
import { createInitials, formatCurrency } from "@/app/utils/format";
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
  SearchInput,
  SectionHeading,
  SelectField,
  Tabs,
  TextField,
} from "@/app/components/ui";
import { Icon } from "@/app/components/ui/icons";

export function BookingsPage({
  onToast,
}: {
  onToast: (message: string) => void;
}) {
  const [items, setItems] = usePersistentState<Booking[]>(
    "barracks-bookings-v2",
    initialBookings,
  );
  const [tab, setTab] = useState("today");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Booking | null>(null);
  const [editing, setEditing] = useState<Booking | null>(null);
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterBarber, setFilterBarber] = useState("All barbers");
  const [filterService, setFilterService] = useState("All services");
  const [draft, setDraft] = useState({
    customer: customers[0]?.name ?? "",
    service: services[0]?.name ?? "",
    barber: barbers[0]?.name ?? "",
    time: "",
    meridiem: "AM",
    price: "",
  });

  const counts = {
    today: items.length,
    upcoming: items.filter((item) => item.status === "Upcoming").length,
    completed: items.filter((item) => item.status === "Completed").length,
    cancelled: items.filter((item) => item.status === "Cancelled").length,
  };

  const visible = useMemo(
    () =>
      items.filter((item) => {
        const matchesTab =
          tab === "today" ||
          (tab === "upcoming"
            ? item.status === "Upcoming"
            : tab === "completed"
              ? item.status === "Completed"
              : item.status === "Cancelled");
        const query = search.toLowerCase();
        return (
          matchesTab &&
          (filterBarber === "All barbers" || item.barber === filterBarber) &&
          (filterService === "All services" ||
            item.service === filterService) &&
          (!query ||
            (
              item.customer +
              " " +
              item.service +
              " " +
              item.barber +
              " " +
              item.id
            )
              .toLowerCase()
              .includes(query))
        );
      }),
    [filterBarber, filterService, items, search, tab],
  );

  function openNewBooking() {
    const service = services[0];
    if (!service || !customers[0] || !barbers[0]) {
      onToast("Booking options are not available yet");
      return;
    }
    setDraft({
      customer: customers[0].name,
      service: service.name,
      barber: barbers[0].name,
      time: "",
      meridiem: "AM",
      price: String(service.price),
    });
    setBookingModalOpen(true);
  }

  function handleDraftService(name: string) {
    const service = services.find((item) => item.name === name);
    setDraft({
      ...draft,
      service: name,
      price: String(service?.price ?? 0),
    });
  }

  function addBooking(event: React.FormEvent) {
    event.preventDefault();
    if (!draft.customer || !draft.service || !draft.barber || !draft.time) {
      onToast("Complete the booking details first");
      return;
    }
    const service = services.find((item) => item.name === draft.service);
    const created: Booking = {
      id: "BK-" + (1054 + items.length),
      time: draft.time,
      meridiem: draft.meridiem,
      customer: draft.customer,
      initials: createInitials(draft.customer),
      service: draft.service,
      barber: draft.barber,
      price: service?.price ?? Number(draft.price),
      status: "Upcoming",
      tone: "slate",
    };
    setItems((list) => [created, ...list]);
    setBookingModalOpen(false);
    onToast(created.id + " created");
  }

  function saveBooking(event: React.FormEvent) {
    event.preventDefault();
    if (!editing?.customer || !editing.service || !editing.barber) {
      onToast("Complete the booking details first");
      return;
    }
    setItems((list) =>
      list.map((item) => (item.id === editing.id ? editing : item)),
    );
    onToast(editing.id + " updated");
    setEditing(null);
  }

  return (
    <>
      <PageHeader
        title="Bookings"
        action={
          <Button icon="plus" onClick={openNewBooking}>
            New booking
          </Button>
        }
      />
      <div className="booking-tabs-row">
        <Tabs
          active={tab}
          onChange={setTab}
          items={[
            { id: "today", label: "Today", count: counts.today },
            { id: "upcoming", label: "Upcoming", count: counts.upcoming },
            { id: "completed", label: "Completed", count: counts.completed },
            { id: "cancelled", label: "Cancelled", count: counts.cancelled },
          ]}
        />
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search bookings"
        />
      </div>
      <div className="metrics-grid metrics-grid--four">
        <MetricCard
          label="Total bookings"
          value={String(items.length)}
          icon="calendar"
          accent="blue"
        />
        <MetricCard
          label="Completed"
          value={String(counts.completed)}
          change={items.length ? Math.round((counts.completed / items.length) * 100) + "% of current records" : undefined}
          icon="checkCircle"
          accent="green"
        />
        <MetricCard
          label="Remaining"
          value={String(counts.upcoming)}
          icon="clock"
          accent="amber"
        />
        <MetricCard
          label="Cancelled"
          value={String(counts.cancelled)}
          icon="x"
          accent="red"
        />
      </div>

      <Panel className="bookings-panel">
        <SectionHeading
          title={
            tab === "today"
              ? "Today’s schedule"
              : tab[0].toUpperCase() + tab.slice(1) + " bookings"
          }
          action={
            <Button
              variant="ghost"
              size="sm"
              icon="filter"
              onClick={() => setFiltersOpen(true)}
            >
              Filters
            </Button>
          }
        />
        <div className="booking-list">
          {visible.length ? (
            visible.map((booking) => (
              <button
                className={
                  "booking-row booking-row--" + booking.status.toLowerCase()
                }
                type="button"
                key={booking.id}
                onClick={() => setSelected(booking)}
              >
                <span className="booking-row__time">
                  <strong>{booking.time}</strong>
                  <small>{booking.meridiem}</small>
                </span>
                <span className="booking-row__customer">
                  <Avatar
                    initials={booking.initials}
                    tone={booking.tone}
                    size="sm"
                  />
                  <span>
                    <strong>{booking.customer}</strong>
                    <small>{booking.id}</small>
                  </span>
                </span>
                <span className="booking-row__service">
                  <strong>{booking.service}</strong>
                  <small>with {booking.barber}</small>
                </span>
                <span>
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
                </span>
                <strong className="booking-row__price">
                  {formatCurrency(booking.price)}
                </strong>
                <Icon name="chevronRight" size={16} />
              </button>
            ))
          ) : (
            <EmptyState
              icon="calendar"
              title="No bookings found"
              description="Try a different search or switch to another booking view."
            />
          )}
        </div>
      </Panel>

      <Modal
        open={Boolean(selected)}
        title="Booking detail"
        description={
          selected ? selected.id : undefined
        }
        onClose={() => setSelected(null)}
      >
        <div className="detail-modal">
          <div className="detail-modal__identity">
            {selected && (
              <Avatar
                initials={selected.initials}
                tone={selected.tone}
                size="lg"
              />
            )}
            <div>
              <strong>{selected?.customer}</strong>
              <span>{selected?.service}</span>
            </div>
            <Badge
              tone={
                selected?.status === "Completed"
                  ? "success"
                  : selected?.status === "Upcoming"
                    ? "warning"
                    : "danger"
              }
            >
              {selected?.status}
            </Badge>
          </div>
          <div className="detail-facts">
            <span>
              <small>Time</small>
              <strong>
                {selected?.time} {selected?.meridiem}
              </strong>
            </span>
            <span>
              <small>Barber</small>
              <strong>{selected?.barber}</strong>
            </span>
            <span>
              <small>Total</small>
              <strong>{selected && formatCurrency(selected.price)}</strong>
            </span>
          </div>
          <div className="modal-actions">
            <Button
              variant="secondary"
              onClick={() => {
                if (selected) setEditing({ ...selected });
                setSelected(null);
              }}
            >
              Edit booking
            </Button>
            {selected?.status === "Upcoming" && (
              <Button
                variant="danger"
                onClick={() => {
                  setItems((list) =>
                    list.map((item) =>
                      item.id === selected.id
                        ? { ...item, status: "Cancelled" }
                        : item,
                    ),
                  );
                  setSelected(null);
                  onToast("Booking cancelled");
                }}
              >
                Cancel booking
              </Button>
            )}
          </div>
        </div>
      </Modal>

      <Modal
        open={bookingModalOpen}
        title="New booking"
        onClose={() => setBookingModalOpen(false)}
      >
        <form className="modal-form" onSubmit={addBooking}>
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
            onChange={(event) => handleDraftService(event.target.value)}
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
            {barbers.map((barber) => (
              <option key={barber.id}>{barber.name}</option>
            ))}
          </SelectField>
          <div className="form-grid form-grid--two">
            <TextField
              label="Time"
              type="time"
              value={draft.time}
              onChange={(event) =>
                setDraft({ ...draft, time: event.target.value })
              }
            />
            <SelectField
              label="Period"
              value={draft.meridiem}
              onChange={(event) =>
                setDraft({ ...draft, meridiem: event.target.value })
              }
            >
              <option>AM</option>
              <option>PM</option>
            </SelectField>
          </div>
          <div className="modal-actions">
            <Button
              variant="secondary"
              type="button"
              onClick={() => setBookingModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" icon="calendar">
              Create booking
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(editing)}
        title="Edit booking"
        onClose={() => setEditing(null)}
      >
        {editing && (
          <form className="modal-form" onSubmit={saveBooking}>
            <SelectField
              label="Customer"
              value={editing.customer}
              onChange={(event) =>
                setEditing({
                  ...editing,
                  customer: event.target.value,
                  initials: createInitials(event.target.value),
                })
              }
            >
              {customers.map((customer) => (
                <option key={customer.id}>{customer.name}</option>
              ))}
            </SelectField>
            <SelectField
              label="Service"
              value={editing.service}
              onChange={(event) =>
                setEditing({ ...editing, service: event.target.value })
              }
            >
              {services.map((service) => (
                <option key={service.id}>{service.name}</option>
              ))}
            </SelectField>
            <SelectField
              label="Barber"
              value={editing.barber}
              onChange={(event) =>
                setEditing({ ...editing, barber: event.target.value })
              }
            >
              {barbers.map((barber) => (
                <option key={barber.id}>{barber.name}</option>
              ))}
            </SelectField>
            <div className="form-grid form-grid--two">
              <TextField
                label="Time"
                type="time"
                value={editing.time}
                onChange={(event) =>
                  setEditing({ ...editing, time: event.target.value })
                }
              />
              <SelectField
                label="Status"
                value={editing.status}
                onChange={(event) =>
                  setEditing({
                    ...editing,
                    status: event.target.value as Booking["status"],
                  })
                }
              >
                <option>Upcoming</option>
                <option>Completed</option>
                <option>Cancelled</option>
              </SelectField>
            </div>
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
        open={filtersOpen}
        title="Filter bookings"
        onClose={() => setFiltersOpen(false)}
      >
        <div className="modal-form">
          <SelectField
            label="Barber"
            value={filterBarber}
            onChange={(event) => setFilterBarber(event.target.value)}
          >
            <option>All barbers</option>
            {barbers.map((barber) => (
              <option key={barber.id}>{barber.name}</option>
            ))}
          </SelectField>
          <SelectField
            label="Service"
            value={filterService}
            onChange={(event) => setFilterService(event.target.value)}
          >
            <option>All services</option>
            {services.map((service) => (
              <option key={service.id}>{service.name}</option>
            ))}
          </SelectField>
          <div className="modal-actions">
            <Button type="button" onClick={() => setFiltersOpen(false)}>
              Apply filters
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
