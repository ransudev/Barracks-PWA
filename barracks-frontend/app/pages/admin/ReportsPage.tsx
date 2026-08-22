"use client";

import { useState } from "react";
import { customers } from "@/app/data/customers";
import { revenueByService, topCustomerValues } from "@/app/data/reports";
import { transactions } from "@/app/data/transactions";
import { formatCurrency } from "@/app/utils/format";
import {
  Avatar,
  Button,
  MetricCard,
  Modal,
  PageHeader,
  Panel,
  ProgressBar,
  SectionHeading,
  SelectField,
} from "@/app/components/ui";
import { Icon } from "@/app/components/ui/icons";
import { downloadCsv } from "@/app/utils/download";

export function ReportsPage({
  onToast,
}: {
  onToast: (message: string) => void;
}) {
  const [range, setRange] = useState("This month");
  const [ledgerOpen, setLedgerOpen] = useState(false);

  function exportReport() {
    const filename =
      "barracks-" +
      range.toLowerCase().replace(/[^a-z0-9]+/g, "-") +
      "-report.csv";
    downloadCsv(
      filename,
      [
        "Date",
        "Customer",
        "Service",
        "Barber",
        "Payment method",
        "Amount",
        "Status",
      ],
      transactions.map((transaction) => [
        transaction.date,
        transaction.customer,
        transaction.service,
        transaction.barber,
        transaction.method,
        transaction.amount,
        transaction.status,
      ]),
    );
    onToast(range + " report exported");
  }

  return (
    <>
      <PageHeader
        title="Reports & analytics"
        action={
          <div className="page-header__actions">
            <SelectField
              value={range}
              onChange={(event) => setRange(event.target.value)}
            >
              <option>This month</option>
              <option>Last month</option>
              <option>This quarter</option>
            </SelectField>
            <Button variant="success" icon="download" onClick={exportReport}>
              Export
            </Button>
          </div>
        }
      />
      <div className="metrics-grid metrics-grid--four">
        <MetricCard
          label="Total revenue"
          value="$12,485"
          change="+13% vs last period"
          icon="wallet"
          accent="green"
        />
        <MetricCard
          label="Total transactions"
          value="312"
          change="+24 vs last period"
          icon="creditCard"
          accent="blue"
        />
        <MetricCard
          label="Customers served"
          value="48"
          change="+12 vs last period"
          icon="users"
          accent="violet"
        />
        <MetricCard
          label="Commission paid"
          value="$3,745"
          icon="spark"
          accent="amber"
        />
      </div>

      <div className="report-grid">
        <Panel>
          <SectionHeading title="Revenue by service" />
          <div className="report-bars">
            {revenueByService.map((item) => (
              <div className="report-bar" key={item.label}>
                <div className="report-bar__head">
                  <span>{item.label}</span>
                  <strong>
                    {formatCurrency(item.value)}{" "}
                    <small>({item.percent}%)</small>
                  </strong>
                </div>
                <ProgressBar value={item.percent * 2.8} tone={item.tone} />
              </div>
            ))}
          </div>
        </Panel>
        <Panel>
          <SectionHeading title="Top customers" />
          <div className="top-customers">
            {customers.slice(0, 5).map((customer, index) => (
              <div key={customer.id}>
                <span className={"rank rank--" + (index + 1)}>{index + 1}</span>
                <Avatar
                  initials={customer.initials}
                  tone={customer.tone}
                  size="sm"
                />
                <span>
                  <strong>{customer.name}</strong>
                  <small>{customer.visits} visits</small>
                </span>
                <strong>{formatCurrency(topCustomerValues[index])}</strong>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Panel className="report-transactions" id="report-transactions">
        <SectionHeading
          title="Recent transactions"
          action={
            <button
              className="link-button"
              type="button"
              onClick={() => setLedgerOpen(true)}
            >
              View all <Icon name="arrowRight" size={14} />
            </button>
          }
        />
        <div className="report-transaction-table">
          <div>
            <span>Date</span>
            <span>Customer</span>
            <span>Service</span>
            <span>Barber</span>
            <span>Amount</span>
          </div>
          {transactions.map((transaction) => (
            <div key={transaction.id}>
              <span>{transaction.date}</span>
              <strong>{transaction.customer}</strong>
              <span>{transaction.service}</span>
              <span>{transaction.barber}</span>
              <strong className="text-green">
                {formatCurrency(transaction.amount)}
              </strong>
            </div>
          ))}
        </div>
      </Panel>

      <Modal
        open={ledgerOpen}
        title="Transaction ledger"
        description="All recorded transactions in the selected report range."
        onClose={() => setLedgerOpen(false)}
        width="lg"
      >
        <div className="detail-modal">
          <div className="report-transaction-table">
            <div>
              <span>Date</span>
              <span>Customer</span>
              <span>Service</span>
              <span>Barber</span>
              <span>Amount</span>
            </div>
            {transactions.map((transaction) => (
              <div key={transaction.id}>
                <span>{transaction.date}</span>
                <strong>{transaction.customer}</strong>
                <span>{transaction.service}</span>
                <span>{transaction.barber}</span>
                <strong className="text-green">
                  {formatCurrency(transaction.amount)}
                </strong>
              </div>
            ))}
          </div>
          <div className="modal-actions">
            <Button type="button" onClick={() => setLedgerOpen(false)}>
              Done
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
