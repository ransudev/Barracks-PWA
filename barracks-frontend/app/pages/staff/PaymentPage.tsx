"use client";

import { useState } from "react";
import { barbers } from "@/app/data/barbers";
import { customers } from "@/app/data/customers";
import { services } from "@/app/data/services";
import { transactions as initialTransactions } from "@/app/data/transactions";
import type { IconName } from "@/app/components/ui/icons";
import { formatCurrency } from "@/app/utils/format";
import { usePersistentState } from "@/app/hooks/usePersistentState";
import {
  Avatar,
  Button,
  MetricCard,
  Modal,
  PageHeader,
  Panel,
  SectionHeading,
  SelectField,
} from "@/app/components/ui";
import { Icon } from "@/app/components/ui/icons";

export function PaymentPage({
  onToast,
}: {
  onToast: (message: string) => void;
}) {
  const [customerId, setCustomerId] = useState(customers[0].id);
  const [serviceId, setServiceId] = useState(services[0].id);
  const [barberId, setBarberId] = useState(barbers[0].id);
  const [method, setMethod] = useState("Card");
  const [recent, setRecent] = usePersistentState(
    "barracks-transactions",
    initialTransactions,
  );
  const [historyOpen, setHistoryOpen] = useState(false);

  const selectedCustomer =
    customers.find((customer) => customer.id === customerId) ?? customers[0];
  const selectedService =
    services.find((service) => service.id === serviceId) ?? services[0];
  const selectedBarber =
    barbers.find((barber) => barber.id === barberId) ?? barbers[0];
  const revenue = recent.reduce(
    (total, transaction) => total + transaction.amount,
    0,
  );
  const averageTransaction = recent.length ? revenue / recent.length : 0;

  function completePayment() {
    setRecent((list) => [
      {
        id: "TX-" + (8242 + list.length),
        date: "Apr 14, 2026",
        customer: selectedCustomer.name,
        service: selectedService.name,
        barber: selectedBarber.name,
        method,
        amount: selectedService.price,
        status: "Paid",
      },
      ...list,
    ]);
    onToast(
      formatCurrency(selectedService.price) +
        " payment completed for " +
        selectedCustomer.name,
    );
  }

  const paymentMethods: Array<{ id: string; icon: IconName }> = [
    { id: "Cash", icon: "cash" },
    { id: "Card", icon: "creditCard" },
    { id: "Mobile", icon: "mobile" },
  ];

  return (
    <>
      <PageHeader
        title="Process payment"
        action={
          <Button
            variant="ghost"
            icon="refresh"
            onClick={() => {
              setRecent((list) => [...list]);
              onToast("Payment workspace refreshed");
            }}
          >
            Refresh
          </Button>
        }
      />
      <div className="metrics-grid metrics-grid--four">
        <MetricCard
          label="Today’s revenue"
          value={formatCurrency(revenue)}
          change="+15% from yesterday"
          icon="wallet"
          accent="green"
        />
        <MetricCard
          label="Transactions"
          value={String(recent.length)}
          icon="creditCard"
          accent="blue"
        />
        <MetricCard
          label="Average transaction"
          value={formatCurrency(averageTransaction)}
          icon="chart"
          accent="violet"
        />
        <MetricCard
          label="Commission due"
          value="$145.50"
          icon="spark"
          accent="amber"
        />
      </div>

      <div className="payment-grid">
        <Panel className="payment-form-panel">
          <SectionHeading title="New transaction" />
          <div className="form-grid">
            <SelectField
              label="Customer"
              value={customerId}
              onChange={(event) => setCustomerId(event.target.value)}
            >
              {customers.map((customer) => (
                <option value={customer.id} key={customer.id}>
                  {customer.name}
                </option>
              ))}
            </SelectField>
            <SelectField
              label="Service"
              value={serviceId}
              onChange={(event) => setServiceId(event.target.value)}
            >
              {services
                .filter((service) => service.active)
                .map((service) => (
                  <option value={service.id} key={service.id}>
                    {service.name} · {formatCurrency(service.price)}
                  </option>
                ))}
            </SelectField>
            <SelectField
              label="Barber"
              value={barberId}
              onChange={(event) => setBarberId(event.target.value)}
            >
              {barbers.map((barber) => (
                <option value={barber.id} key={barber.id}>
                  {barber.name}
                </option>
              ))}
            </SelectField>
          </div>
          <div className="payment-summary">
            <span>
              <small>Subtotal</small>
              <strong>{formatCurrency(selectedService.price)}</strong>
            </span>
            <span>
              <small>Customer loyalty</small>
              <strong className="text-green">– $0.00</strong>
            </span>
            <span className="payment-summary__total">
              <small>Total</small>
              <strong>{formatCurrency(selectedService.price)}</strong>
            </span>
          </div>
          <div className="payment-methods">
            <span className="field__label">Payment method</span>
            <div>
              {paymentMethods.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className={method === item.id ? "is-active" : ""}
                  onClick={() => setMethod(item.id)}
                >
                  <Icon name={item.icon} size={17} />
                  {item.id}
                </button>
              ))}
            </div>
          </div>
          <Button
            size="lg"
            variant="success"
            icon="check"
            className="payment-submit"
            onClick={completePayment}
          >
            Complete payment
          </Button>
        </Panel>

        <Panel className="recent-transactions-panel">
          <SectionHeading
            title="Recent transactions"
            action={
              <button
                className="link-button"
                type="button"
                onClick={() => setHistoryOpen(true)}
              >
                View all <Icon name="arrowRight" size={14} />
              </button>
            }
          />
          <div className="transaction-list">
            {recent.slice(0, 5).map((transaction) => (
              <div className="transaction-row" key={transaction.id}>
                <Avatar
                  initials={transaction.customer
                    .split(" ")
                    .map((name) => name[0])
                    .join("")}
                  tone="slate"
                  size="sm"
                />
                <span>
                  <strong>{transaction.customer}</strong>
                  <small>
                    {transaction.service} · {transaction.method}
                  </small>
                </span>
                <span>
                  <strong className="text-green">
                    {formatCurrency(transaction.amount)}
                  </strong>
                  <small>{transaction.date}</small>
                </span>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Modal
        open={historyOpen}
        title="Transaction history"
        description="All transactions recorded in this workspace."
        onClose={() => setHistoryOpen(false)}
        width="lg"
      >
        <div className="detail-modal">
          <div className="transaction-list">
            {recent.map((transaction) => (
              <div className="transaction-row" key={transaction.id}>
                <Avatar
                  initials={transaction.customer
                    .split(" ")
                    .map((name) => name[0])
                    .join("")}
                  tone="slate"
                  size="sm"
                />
                <span>
                  <strong>{transaction.customer}</strong>
                  <small>
                    {transaction.service + " · " + transaction.method}
                  </small>
                </span>
                <span>
                  <strong className="text-green">
                    {formatCurrency(transaction.amount)}
                  </strong>
                  <small>{transaction.date}</small>
                </span>
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
    </>
  );
}
