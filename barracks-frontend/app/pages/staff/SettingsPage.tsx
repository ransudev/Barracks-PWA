"use client";

import { useRef, useState, type ChangeEvent } from "react";
import {
  Avatar,
  Badge,
  Button,
  PageHeader,
  Panel,
  SectionHeading,
  TextField,
  Toggle,
} from "@/app/components/ui";

export function StaffSettingsPage({
  go,
  onToast,
}: {
  go: (view: "landing") => void;
  onToast: (message: string) => void;
}) {
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [soundNotifications, setSoundNotifications] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [name, setName] = useState("Jules Mendoza");
  const [email, setEmail] = useState("jules@barracks.ph");
  const [role, setRole] = useState("Front desk");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const photoInput = useRef<HTMLInputElement>(null);

  function saveSettings() {
    if (!name.trim() || !email.includes("@")) {
      onToast("Enter a valid name and email address");
      return;
    }
    onToast("Settings saved");
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

  function handlePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) onToast(file.name + " selected");
  }

  return (
    <>
      <PageHeader
        title="Settings"
        action={
          <Button icon="check" onClick={saveSettings}>
            Save changes
          </Button>
        }
      />
      <div className="settings-grid">
        <Panel>
          <SectionHeading title="Profile" />
          <div className="settings-profile">
            <Avatar initials="JM" tone="blue" size="lg" />
            <div>
              <strong>{name}</strong>
              <small>Front desk · Shop floor</small>
              <button
                className="link-button"
                type="button"
                onClick={() => photoInput.current?.click()}
              >
                Change photo
              </button>
              <input
                ref={photoInput}
                className="visually-hidden"
                type="file"
                accept="image/*"
                onChange={handlePhoto}
              />
            </div>
          </div>
          <div className="form-grid">
            <TextField
              label="Full name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <TextField
              label="Email address"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
            />
            <TextField
              label="Role"
              value={role}
              onChange={(event) => setRole(event.target.value)}
            />
          </div>
        </Panel>

        <Panel>
          <SectionHeading title="Preferences" />
          <div className="settings-toggles">
            <Toggle
              checked={emailNotifications}
              onChange={setEmailNotifications}
              label="Email notifications"
              description="Receive daily close and low stock alerts."
            />
            <Toggle
              checked={soundNotifications}
              onChange={setSoundNotifications}
              label="Sound notifications"
              description="Play a subtle cue for queue updates."
            />
            <Toggle
              checked={autoRefresh}
              onChange={setAutoRefresh}
              label="Auto-refresh dashboard"
              description="Keep queue data current every 60 seconds."
            />
          </div>
        </Panel>

        <Panel>
          <SectionHeading title="Change password" />
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
            Update password
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
              <small>Last updated</small>
              <strong>April 14, 2026</strong>
            </span>
            <span>
              <small>Environment</small>
              <Badge tone="success">Active</Badge>
            </span>
          </div>
          <div className="system-info__actions">
            <button
              className="link-button link-button--danger"
              type="button"
              onClick={() => {
                go("landing");
                onToast("Signed out");
              }}
            >
              Sign out
            </button>
          </div>
        </Panel>
      </div>
    </>
  );
}
