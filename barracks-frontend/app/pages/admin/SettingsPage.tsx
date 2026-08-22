"use client";

import { useState } from "react";
import {
  Badge,
  Button,
  PageHeader,
  Panel,
  SectionHeading,
  SelectField,
  TextField,
  Toggle,
} from "@/app/components/ui";

export function AdminSettings({
  onToast,
}: {
  onToast: (message: string) => void;
}) {
  const [loyalty, setLoyalty] = useState(true);
  const [lowStock, setLowStock] = useState(true);
  const [dailyReport, setDailyReport] = useState(true);
  const [leaveRequests, setLeaveRequests] = useState(false);
  const [businessName, setBusinessName] = useState("Barracks Barbers & Shaves");
  const [address, setAddress] = useState("14 Jupiter Street, Makati");
  const [phone, setPhone] = useState("+63 917 555 0144");
  const [email, setEmail] = useState("hello@barracks.ph");
  const [commissionRate, setCommissionRate] = useState("30");
  const [payoutSchedule, setPayoutSchedule] = useState("Bi-weekly");
  const [pointsPerDollar, setPointsPerDollar] = useState("1");
  const [pointsValue, setPointsValue] = useState("0.05");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  function saveBusinessInfo() {
    if (
      !businessName.trim() ||
      !address.trim() ||
      !phone.trim() ||
      !email.includes("@")
    ) {
      onToast("Complete the business information first");
      return;
    }
    onToast("Business information saved");
  }

  function saveCommissionSettings() {
    const rate = Number(commissionRate);
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
      onToast("Commission rate must be between 0 and 100");
      return;
    }
    onToast("Commission settings updated");
  }

  function saveLoyaltySettings() {
    if (Number(pointsPerDollar) < 0 || Number(pointsValue) < 0) {
      onToast("Loyalty values cannot be negative");
      return;
    }
    onToast("Loyalty settings updated");
  }

  function updatePassword() {
    if (!currentPassword || newPassword.length < 8) {
      onToast(
        "Enter your current password and a new password with 8 or more characters",
      );
      return;
    }
    if (newPassword !== confirmPassword) {
      onToast("New passwords do not match");
      return;
    }
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    onToast("Password updated");
  }

  function resetNotificationPreferences() {
    setLowStock(true);
    setDailyReport(true);
    setLeaveRequests(false);
    onToast("Notification preferences reset");
  }

  return (
    <>
      <PageHeader
        title="Settings"
        action={
          <Button icon="check" onClick={saveBusinessInfo}>
            Save changes
          </Button>
        }
      />
      <div className="settings-grid">
        <Panel>
          <SectionHeading title="Business information" />
          <div className="form-grid">
            <TextField
              label="Business name"
              value={businessName}
              onChange={(event) => setBusinessName(event.target.value)}
            />
            <TextField
              label="Address"
              value={address}
              onChange={(event) => setAddress(event.target.value)}
            />
            <TextField
              label="Phone"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />
            <TextField
              label="Email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <Button variant="secondary" onClick={saveBusinessInfo}>
            Save business info
          </Button>
        </Panel>

        <Panel>
          <SectionHeading title="Commission settings" />
          <div className="form-grid">
            <TextField
              label="Default commission rate"
              value={commissionRate}
              onChange={(event) => setCommissionRate(event.target.value)}
              type="number"
            />
            <SelectField
              label="Payout schedule"
              value={payoutSchedule}
              onChange={(event) => setPayoutSchedule(event.target.value)}
            >
              <option>Bi-weekly</option>
              <option>Monthly</option>
              <option>Weekly</option>
            </SelectField>
          </div>
          <Button
            variant="secondary"
            icon="check"
            onClick={saveCommissionSettings}
          >
            Update commission
          </Button>
        </Panel>

        <Panel>
          <SectionHeading title="Loyalty program" />
          <div className="settings-toggles">
            <Toggle
              checked={loyalty}
              onChange={setLoyalty}
              label="Enable loyalty program"
              description="Customers earn points with every paid service."
            />
          </div>
          <div className="form-grid form-grid--two">
            <TextField
              label="Points per $1 spent"
              value={pointsPerDollar}
              onChange={(event) => setPointsPerDollar(event.target.value)}
              type="number"
            />
            <TextField
              label="Points value ($)"
              value={pointsValue}
              onChange={(event) => setPointsValue(event.target.value)}
              type="number"
            />
          </div>
          <Button variant="secondary" onClick={saveLoyaltySettings}>
            Update loyalty settings
          </Button>
        </Panel>

        <Panel>
          <SectionHeading title="Notifications" />
          <div className="settings-toggles">
            <Toggle
              checked={lowStock}
              onChange={setLowStock}
              label="Low stock alerts"
              description="Notify when inventory falls below minimum."
            />
            <Toggle
              checked={dailyReport}
              onChange={setDailyReport}
              label="Daily summary report"
              description="Receive the shop’s close summary."
            />
            <Toggle
              checked={leaveRequests}
              onChange={setLeaveRequests}
              label="Staff leave requests"
              description="Notify when a team member submits leave."
            />
          </div>
        </Panel>

        <Panel>
          <SectionHeading title="Account security" />
          <div className="form-grid">
            <TextField
              label="Current password"
              type="password"
              placeholder="Enter current password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
            />
            <TextField
              label="New password"
              type="password"
              placeholder="At least 8 characters"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
            />
            <TextField
              label="Confirm new password"
              type="password"
              placeholder="Repeat new password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </div>
          <Button variant="secondary" icon="lock" onClick={updatePassword}>
            Change password
          </Button>
        </Panel>

        <Panel className="system-info-panel">
          <SectionHeading title="System information" />
          <div className="system-info">
            <span>
              <small>Version</small>
              <strong>1.0.0</strong>
            </span>
            <span>
              <small>Last backup</small>
              <strong>Not connected</strong>
            </span>
            <span>
              <small>Environment</small>
              <Badge tone="success">Active</Badge>
            </span>
          </div>
          <div className="system-danger-zone">
            <strong>Account actions</strong>
            <p>Reset notification preferences to their default values.</p>
            <button
              className="link-button link-button--danger"
              type="button"
              onClick={resetNotificationPreferences}
            >
              Reset preferences
            </button>
          </div>
        </Panel>
      </div>
    </>
  );
}
