"use client";

import { useState, type FormEvent } from "react";
import { barbers } from "@/app/data/barbers";
import { customers } from "@/app/data/customers";
import { services } from "@/app/data/services";
import type { ViewId } from "@/app/types/domain";
import { transactions } from "@/app/data/transactions";
import { createInitials, formatCurrency } from "@/app/utils/format";
import { usePersistentState } from "@/app/hooks/usePersistentState";
import {
  Avatar,
  Badge,
  Button,
  Logo,
  PageHeader,
  Panel,
  ProgressBar,
  SectionHeading,
  Modal,
  SelectField,
  TextField,
} from "@/app/components/ui";
import { Icon } from "@/app/components/ui/icons";

type CustomerProfileProps = {
  go: (view: ViewId) => void;
  onToast: (message: string) => void;
};

export function CustomerProfile({ go, onToast }: CustomerProfileProps) {
  const [customer, setCustomer] = usePersistentState(
    "barracks-customer-profile",
    customers[0],
  );
  const [nextVisit, setNextVisit] = usePersistentState(
    "barracks-customer-next-visit",
    {
      id: "BK-1050",
      day: "Tuesday",
      date: "April 14, 2026",
      time: "2:30 PM",
      service: "Haircut",
      barber: "Kai Mercer",
      status: "Confirmed",
    },
  );
  const [bookingOpen, setBookingOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileDraft, setProfileDraft] = useState({
    name: customer.name,
    email: customer.email,
    phone: customer.phone,
  });
  const [bookingDraft, setBookingDraft] = useState({
    date: "2026-04-21",
    time: "10:00",
    service: services[0].name,
    barber: barbers[0].name,
  });

  function openBooking() {
    setBookingDraft({
      date: "2026-04-21",
      time: "10:00",
      service: services[0].name,
      barber: barbers[0].name,
    });
    setBookingOpen(true);
  }

  function createBooking(event: FormEvent) {
    event.preventDefault();
    if (!bookingDraft.date || !bookingDraft.time) {
      onToast("Choose a date and time for the visit");
      return;
    }
    const visitDate = new Date(bookingDraft.date + "T12:00:00");
    setNextVisit({
      id: "BK-" + String(Date.now()).slice(-4),
      day: visitDate.toLocaleDateString("en-US", { weekday: "long" }),
      date: visitDate.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      }),
      time: bookingDraft.time,
      service: bookingDraft.service,
      barber: bookingDraft.barber,
      status: "Confirmed",
    });
    setBookingOpen(false);
    onToast("Visit booked successfully");
  }

  function saveProfile(event: FormEvent) {
    event.preventDefault();
    if (!profileDraft.name.trim() || !profileDraft.email.includes("@")) {
      onToast("Enter a valid name and email address");
      return;
    }
    setCustomer({
      ...customer,
      name: profileDraft.name,
      initials: profileDraft.name
        .split(" ")
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase(),
      email: profileDraft.email,
      phone: profileDraft.phone,
    });
    setProfileOpen(false);
    onToast("Profile updated");
  }

  function openProfile() {
    setProfileDraft({
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
    });
    setProfileOpen(true);
  }

  return (
    <div className="customer-page">
      <header className="customer-topbar">
        <Logo onClick={() => go("landing")} />
        <div className="customer-topbar__links">
          <span>Account</span>
          <button type="button" onClick={() => go("landing")}>
            Back to site <Icon name="arrowRight" size={15} />
          </button>
          <button
            className="customer-topbar__staff"
            type="button"
            onClick={() => go("login")}
          >
            Staff sign in
          </button>
        </div>
      </header>

      <main className="customer-content">
        <PageHeader
          title={"Good afternoon, " + customer.name.split(" ")[0] + "."}
          action={
            <Button icon="calendar" onClick={openBooking}>
              Book a new visit
            </Button>
          }
        />

        <div className="customer-grid">
          <div className="customer-main-column">
            <Panel className="customer-next-visit">
              <div className="customer-next-visit__top">
                <div>
                  <span className="page-eyebrow">Next visit</span>
                  <Badge
                    tone={
                      nextVisit.status === "Confirmed" ? "warning" : "danger"
                    }
                  >
                    {nextVisit.status}
                  </Badge>
                </div>
                <span className="customer-next-visit__id">{nextVisit.id}</span>
              </div>
              <div className="customer-next-visit__date">
                <strong>{nextVisit.day}</strong>
                <span>{nextVisit.date}</span>
              </div>
              <div className="customer-next-visit__details">
                <div>
                  <Icon name="clock" size={16} />
                  <span>
                    <small>Time</small>
                    <strong>{nextVisit.time}</strong>
                  </span>
                </div>
                <div>
                  <Icon name="scissors" size={16} />
                  <span>
                    <small>Service</small>
                    <strong>{nextVisit.service}</strong>
                  </span>
                </div>
                <div>
                  <Avatar
                    initials={createInitials(nextVisit.barber)}
                    tone="blue"
                    size="sm"
                  />
                  <span>
                    <small>With</small>
                    <strong>{nextVisit.barber}</strong>
                  </span>
                </div>
              </div>
              <div className="customer-next-visit__actions">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setDetailsOpen(true)}
                >
                  View details
                </Button>
                <button
                  className="link-button link-button--danger"
                  type="button"
                  onClick={() => setCancelOpen(true)}
                >
                  Cancel visit
                </button>
              </div>
            </Panel>

            <Panel>
              <SectionHeading
                title="Recent visits"
                action={
                  <button
                    className="link-button"
                    type="button"
                    onClick={() => setHistoryOpen(true)}
                  >
                    View all
                  </button>
                }
              />
              <div className="history-list">
                <div className="history-row history-row--head">
                  <span>Date</span>
                  <span>Service</span>
                  <span>Barber</span>
                  <span>Amount</span>
                </div>
                {transactions.slice(0, 4).map((transaction) => (
                  <div className="history-row" key={transaction.id}>
                    <span>{transaction.date}</span>
                    <span>
                      <strong>{transaction.service}</strong>
                      <small>{transaction.id}</small>
                    </span>
                    <span>{transaction.barber}</span>
                    <strong>{formatCurrency(transaction.amount)}</strong>
                  </div>
                ))}
              </div>
            </Panel>
          </div>

          <aside className="customer-side-column">
            <Panel className="customer-profile-card">
              <div className="customer-profile-card__head">
                <Avatar
                  initials={customer.initials}
                  tone={customer.tone}
                  size="xl"
                />
                <button
                  className="icon-button"
                  type="button"
                  aria-label="Edit profile"
                  onClick={openProfile}
                >
                  <Icon name="edit" size={16} />
                </button>
              </div>
              <h2>{customer.name}</h2>
              <p>Member since January 2024</p>
              <div className="customer-profile-card__contact">
                <span>
                  <Icon name="mail" size={15} />
                  {customer.email}
                </span>
                <span>
                  <Icon name="phone" size={15} />
                  {customer.phone}
                </span>
              </div>
              <div className="customer-profile-card__preference">
                <span>Preferred barber</span>
                <strong>{customer.preferredBarber}</strong>
                <small>Classic shape, soft finish</small>
              </div>
            </Panel>

            <Panel className="loyalty-card">
              <div className="loyalty-card__head">
                <div>
                  <span className="page-eyebrow">Barracks loyalty</span>
                  <h2>Keep the ritual going.</h2>
                </div>
                <Icon name="spark" size={20} />
              </div>
              <div className="loyalty-points">
                <strong>{customer.points}</strong>
                <span>points</span>
              </div>
              <ProgressBar value={68} tone="amber" />
              <div className="loyalty-card__meta">
                <span>540 / 800 points</span>
                <strong>Next reward · $10 off</strong>
              </div>
              <p>
                One point for every $1 spent. Your next reward is within reach.
              </p>
            </Panel>
          </aside>
        </div>
      </main>

      <Modal
        open={bookingOpen}
        title="Book a new visit"
        description="Choose a service, barber, and time that work for you."
        onClose={() => setBookingOpen(false)}
      >
        <form className="modal-form" onSubmit={createBooking}>
          <SelectField
            label="Service"
            value={bookingDraft.service}
            onChange={(event) =>
              setBookingDraft({ ...bookingDraft, service: event.target.value })
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
            value={bookingDraft.barber}
            onChange={(event) =>
              setBookingDraft({ ...bookingDraft, barber: event.target.value })
            }
          >
            {barbers
              .filter((barber) => barber.status !== "Off today")
              .map((barber) => (
                <option key={barber.id}>{barber.name}</option>
              ))}
          </SelectField>
          <div className="form-grid form-grid--two">
            <TextField
              label="Date"
              type="date"
              value={bookingDraft.date}
              onChange={(event) =>
                setBookingDraft({ ...bookingDraft, date: event.target.value })
              }
            />
            <TextField
              label="Time"
              type="time"
              value={bookingDraft.time}
              onChange={(event) =>
                setBookingDraft({ ...bookingDraft, time: event.target.value })
              }
            />
          </div>
          <div className="modal-actions">
            <Button
              variant="secondary"
              type="button"
              onClick={() => setBookingOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" icon="calendar">
              Confirm visit
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={detailsOpen}
        title="Appointment details"
        description={nextVisit.id}
        onClose={() => setDetailsOpen(false)}
      >
        <div className="detail-modal">
          <div className="detail-modal__row">
            <span>Date</span>
            <strong>{nextVisit.day + ", " + nextVisit.date}</strong>
          </div>
          <div className="detail-modal__row">
            <span>Time</span>
            <strong>{nextVisit.time}</strong>
          </div>
          <div className="detail-modal__row">
            <span>Service</span>
            <strong>{nextVisit.service}</strong>
          </div>
          <div className="detail-modal__row">
            <span>Barber</span>
            <strong>{nextVisit.barber}</strong>
          </div>
          <div className="modal-actions">
            <Button type="button" onClick={() => setDetailsOpen(false)}>
              Done
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={cancelOpen}
        title="Cancel visit?"
        description="This will release the appointment time for another customer."
        onClose={() => setCancelOpen(false)}
      >
        <div className="modal-form">
          <p className="modal-copy">
            Cancel the {nextVisit.service.toLowerCase()} on {nextVisit.date} at{" "}
            {nextVisit.time}?
          </p>
          <div className="modal-actions">
            <Button
              variant="secondary"
              type="button"
              onClick={() => setCancelOpen(false)}
            >
              Keep visit
            </Button>
            <Button
              variant="danger"
              type="button"
              onClick={() => {
                setNextVisit({ ...nextVisit, status: "Cancelled" });
                setCancelOpen(false);
                onToast("Visit cancelled");
              }}
            >
              Cancel visit
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={historyOpen}
        title="Visit history"
        description="Your completed visits and payments."
        onClose={() => setHistoryOpen(false)}
        width="lg"
      >
        <div className="detail-modal">
          <div className="history-list">
            {transactions.map((transaction) => (
              <div className="history-row" key={transaction.id}>
                <span>{transaction.date}</span>
                <span>
                  <strong>{transaction.service}</strong>
                  <small>{transaction.id}</small>
                </span>
                <span>{transaction.barber}</span>
                <strong>{formatCurrency(transaction.amount)}</strong>
              </div>
            ))}
          </div>
          <div className="modal-actions">
            <Button type="button" onClick={() => setHistoryOpen(false)}>
              Done
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={profileOpen}
        title="Edit profile"
        onClose={() => setProfileOpen(false)}
      >
        <form className="modal-form" onSubmit={saveProfile}>
          <TextField
            label="Full name"
            value={profileDraft.name}
            onChange={(event) =>
              setProfileDraft({ ...profileDraft, name: event.target.value })
            }
          />
          <TextField
            label="Email address"
            type="email"
            value={profileDraft.email}
            onChange={(event) =>
              setProfileDraft({ ...profileDraft, email: event.target.value })
            }
          />
          <TextField
            label="Phone number"
            value={profileDraft.phone}
            onChange={(event) =>
              setProfileDraft({ ...profileDraft, phone: event.target.value })
            }
          />
          <div className="modal-actions">
            <Button
              variant="secondary"
              type="button"
              onClick={() => setProfileOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" icon="check">
              Save profile
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
