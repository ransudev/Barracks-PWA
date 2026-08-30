"use client";

import { useState, type FormEvent } from "react";
import { customers as initialCustomers } from "@/app/data/customers";
import { barbers as initialBarbers } from "@/app/data/barbers";
import { services } from "@/app/data/services";
import { transactions } from "@/app/data/transactions";
import type { Barber, Customer } from "@/app/types/domain";
import { createInitials, createSlug, formatCurrency } from "@/app/utils/format";
import { usePersistentState } from "@/app/hooks/usePersistentState";
import {
  Avatar,
  Button,
  EmptyState,
  Modal,
  PageHeader,
  Panel,
  SearchInput,
  SectionHeading,
  SelectField,
  TextField,
} from "@/app/components/ui";
import { Icon } from "@/app/components/ui/icons";

export function CustomersPage({
  onToast,
}: {
  onToast: (message: string) => void;
}) {
  const [items, setItems] = usePersistentState<Customer[]>(
    "barracks-customers-v2",
    initialCustomers,
  );
  const [barbers] = usePersistentState<Barber[]>(
    "barracks-barbers-v2",
    initialBarbers,
  );
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(initialCustomers[0]?.id ?? "");
  const [editing, setEditing] = useState<Customer | null>(null);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [booking, setBooking] = useState({
    date: "",
    time: "",
    service: "",
  });
  const [newCustomer, setNewCustomer] = useState({
    name: "",
    phone: "",
    email: "",
  });

  const filtered = items.filter((customer) =>
    (customer.name + " " + customer.phone + " " + customer.email)
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const selected =
    items.find((customer) => customer.id === selectedId) ?? items[0];

  function addCustomer(event: FormEvent) {
    event.preventDefault();
    if (!newCustomer.name.trim()) {
      onToast("Add a name before registering a customer");
      return;
    }

    const created: Customer = {
      id: createSlug(newCustomer.name),
      name: newCustomer.name,
      initials: createInitials(newCustomer.name),
      phone: newCustomer.phone,
      email: newCustomer.email,
      visits: 0,
      points: 0,
      preferredBarber: "Not set",
      lastVisit: "New customer",
      tone: "slate",
    };

    setItems((list) => [created, ...list]);
    setSelectedId(created.id);
    setNewCustomer({ name: "", phone: "", email: "" });
    onToast(created.name + " registered in the shop book");
  }

  function saveCustomer(event: FormEvent) {
    event.preventDefault();
    if (!editing?.name.trim() || !editing?.phone.trim()) {
      onToast("Name and phone number are required");
      return;
    }
    setItems((list) =>
      list.map((item) =>
        item.id === editing.id
          ? {
              ...item,
              name: editing.name.trim(),
              initials: createInitials(editing.name),
              phone: editing.phone.trim(),
              email: editing.email.trim() || "No email provided",
              preferredBarber: editing.preferredBarber.trim() || "Not set",
            }
          : item,
      ),
    );
    onToast(editing.name + " updated");
    setEditing(null);
  }

  function createBooking(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;
    onToast("Booking requested for " + selected.name + " on " + booking.date);
    setBookingOpen(false);
  }

  return (
    <>
      <div className="customers-page">
        <PageHeader
          title="Customers"
          action={
            <Button
              icon="userPlus"
              onClick={() =>
                document
                  .getElementById("register-customer")
                  ?.scrollIntoView({ behavior: "smooth" })
              }
            >
              Register customer
            </Button>
          }
        />

        <div className="customer-workspace">
        <Panel className="register-panel" id="register-customer">
          <SectionHeading title="Register new customer" />
          <form onSubmit={addCustomer}>
            <TextField
              label="Full name"
              value={newCustomer.name}
              onChange={(event) =>
                setNewCustomer({ ...newCustomer, name: event.target.value })
              }
              placeholder="e.g. Nico Villanueva"
            />
            <TextField
              label="Phone number"
              value={newCustomer.phone}
              onChange={(event) =>
                setNewCustomer({ ...newCustomer, phone: event.target.value })
              }
              placeholder="+63 917 000 0000"
              icon="phone"
            />
            <TextField
              label="Email address"
              value={newCustomer.email}
              onChange={(event) =>
                setNewCustomer({ ...newCustomer, email: event.target.value })
              }
              placeholder="name@email.com"
              icon="mail"
            />
            <Button type="submit" icon="plus">
              Register customer
            </Button>
          </form>
        </Panel>

        <Panel className="customer-list-panel">
          <SectionHeading
            title="Customer list"
            action={
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Search customers"
              />
            }
          />
          <div className="customer-list">
            {filtered.length ? (
              filtered.map((customer) => (
                <button
                  type="button"
                  className={
                    "customer-list__row " +
                    (selectedId === customer.id ? "is-active" : "")
                  }
                  key={customer.id}
                  onClick={() => setSelectedId(customer.id)}
                >
                  <Avatar
                    initials={customer.initials}
                    tone={customer.tone}
                    size="sm"
                  />
                  <span>
                    <strong>{customer.name}</strong>
                    <small>{customer.phone}</small>
                  </span>
                  <span className="customer-list__stats">
                    <strong>{customer.points} pts</strong>
                    <small>{customer.visits} visits</small>
                  </span>
                  <Icon name="chevronRight" size={15} />
                </button>
              ))
            ) : (
              <EmptyState
                title="No customer found"
                description="Try a different name or contact detail."
              />
            )}
          </div>
        </Panel>
        </div>

        {selected && (
          <Panel className="customer-detail-panel">
          <div className="customer-detail__head">
            <div className="table-person">
              <Avatar
                initials={selected.initials}
                tone={selected.tone}
                size="lg"
              />
              <span>
                <strong>{selected.name}</strong>
                <small>Last visit {selected.lastVisit}</small>
              </span>
            </div>
            <div className="panel-toolbar">
              <Button
                variant="secondary"
                size="sm"
                icon="edit"
                onClick={() => setEditing({ ...selected })}
              >
                Edit profile
              </Button>
              <Button
                variant="ghost"
                size="sm"
                icon="calendar"
                onClick={() => setBookingOpen(true)}
              >
                New booking
              </Button>
            </div>
          </div>
          <div className="customer-detail__facts">
            <span>
              <small>Phone</small>
              <strong>{selected.phone}</strong>
            </span>
            <span>
              <small>Email</small>
              <strong>{selected.email}</strong>
            </span>
            <span>
              <small>Preferred barber</small>
              <strong>{selected.preferredBarber}</strong>
            </span>
            <span>
              <small>Loyalty points</small>
              <strong className="text-amber">{selected.points} pts</strong>
            </span>
          </div>
          <div className="customer-detail__history">
            <SectionHeading title="Visit history" />
            <div className="mini-table">
              <div>
                <span>Date</span>
                <span>Service</span>
                <span>Barber</span>
                <span>Amount</span>
              </div>
              {transactions.length ? transactions.slice(0, 3).map((transaction) => (
                <div key={transaction.id}>
                  <span>{transaction.date}</span>
                  <strong>{transaction.service}</strong>
                  <span>{transaction.barber}</span>
                  <strong>{formatCurrency(transaction.amount)}</strong>
                </div>
              )) : (
                <EmptyState
                  title="No visits yet"
                  description="Completed visits will appear here after a payment is recorded."
                />
              )}
            </div>
          </div>
          </Panel>
        )}

        <Modal
        open={Boolean(editing)}
        title="Edit customer profile"
        onClose={() => setEditing(null)}
      >
        {editing && (
          <form className="modal-form" onSubmit={saveCustomer}>
            <TextField
              label="Full name"
              value={editing.name}
              onChange={(event) =>
                setEditing({ ...editing, name: event.target.value })
              }
            />
            <TextField
              label="Phone number"
              value={editing.phone}
              onChange={(event) =>
                setEditing({ ...editing, phone: event.target.value })
              }
              icon="phone"
            />
            <TextField
              label="Email address"
              type="email"
              value={editing.email}
              onChange={(event) =>
                setEditing({ ...editing, email: event.target.value })
              }
              icon="mail"
            />
            <SelectField
              label="Preferred barber"
              value={editing.preferredBarber}
              onChange={(event) =>
                setEditing({ ...editing, preferredBarber: event.target.value })
              }
            >
              <option value="Not set">Not set</option>
              {barbers.map((barber) => (
                <option key={barber.id} value={barber.name}>
                  {barber.name}
                </option>
              ))}
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
        open={bookingOpen}
        title={selected ? "New booking for " + selected.name : "New booking"}
        onClose={() => setBookingOpen(false)}
      >
        <form className="modal-form" onSubmit={createBooking}>
          <div className="form-grid form-grid--two">
            <TextField
              label="Date"
              type="date"
              value={booking.date}
              onChange={(event) =>
                setBooking({ ...booking, date: event.target.value })
              }
            />
            <TextField
              label="Time"
              type="time"
              value={booking.time}
              onChange={(event) =>
                setBooking({ ...booking, time: event.target.value })
              }
            />
          </div>
          <SelectField
            label="Service"
            value={booking.service}
            onChange={(event) =>
              setBooking({ ...booking, service: event.target.value })
            }
          >
            {services.map((service) => <option key={service.id}>{service.name}</option>)}
          </SelectField>
          <div className="modal-actions">
            <Button
              variant="secondary"
              type="button"
              onClick={() => setBookingOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" icon="calendar">
              Create booking
            </Button>
          </div>
        </form>
        </Modal>
      </div>
    </>
  );
}
