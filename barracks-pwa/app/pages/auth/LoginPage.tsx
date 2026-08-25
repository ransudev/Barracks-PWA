"use client";

import { useState, type FormEvent } from "react";
import type { ViewId } from "@/app/types/domain";
import { Button, Logo, Modal, TextField } from "@/app/components/ui";
import { Icon } from "@/app/components/ui/icons";

type LoginPageProps = {
  go: (view: ViewId) => void;
  onToast: (message: string) => void;
};

type AuthMode = "login" | "signup";

export function LoginPage({ go, onToast }: LoginPageProps) {
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [error, setError] = useState("");
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!email.includes("@")) {
      setError("Enter a valid email address.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setError("");
    onToast("Signed in");
    go("staff-dashboard");
  }

  function submitSignup(event: FormEvent) {
    event.preventDefault();
    const name = signupName.trim();
    const accountEmail = signupEmail.trim();

    if (!name) {
      setError("Enter your full name.");
      return;
    }
    if (!accountEmail.includes("@")) {
      setError("Enter a valid email address.");
      return;
    }
    if (signupPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setError("");
    onToast("Customer signup is not connected yet");
  }

  function switchAuthMode(nextMode: AuthMode) {
    setAuthMode(nextMode);
    setError("");
  }

  function sendRecovery(event: FormEvent) {
    event.preventDefault();
    if (!recoveryEmail.includes("@")) {
      onToast("Enter a valid email address");
      return;
    }
    setRecoveryOpen(false);
    onToast("Password reset instructions sent");
  }

  return (
    <div className="login-page">
      <div className="login-page__aside">
        <button
          className="login-back"
          type="button"
          onClick={() => go("landing")}
        >
          <Icon name="chevronLeft" size={15} />
          Back to Barracks
        </button>
        <div className="login-aside__brand">
          <Logo />
          <span className="login-aside__slash" />
          <span className="login-aside__label">
            A shop floor
            <br />
            with a better memory.
          </span>
        </div>
        <div className="login-aside__mark">
          <span>B</span>
          <small>BAR-01 / ACCESS</small>
        </div>
        <div className="login-aside__footer">
          <span>PRIVATE WORKSPACE</span>
          <strong>
            Built for the people
            <br />
            behind the chair.
          </strong>
        </div>
      </div>

      <main className="login-page__main">
        <div className="login-card">
          <div className="login-card__head">
            <h1>
              {authMode === "login"
                ? "Good to see you."
                : "Make room for better visits."}
            </h1>
            <p>
              {authMode === "login"
                ? "Sign in to pick up where the day left off."
                : "Create a customer account to manage your Barracks visits."}
            </p>
          </div>

          {authMode === "login" ? (
            <form className="login-form" onSubmit={submit}>
              <TextField
                label="Email address"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                icon="mail"
              />
              <label className="field">
                <span className="field__label">Password</span>
                <span className="input-wrap">
                  <Icon name="lock" size={16} />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                  <button
                    type="button"
                    className="input-action"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    <Icon name={showPassword ? "eyeOff" : "eye"} size={16} />
                  </button>
                </span>
              </label>
              <div className="login-form__meta">
                <label className="checkbox-label">
                  <input type="checkbox" defaultChecked />{" "}
                  <span>Keep me signed in</span>
                </label>
                <button
                  type="button"
                  className="link-button"
                  onClick={() => setRecoveryOpen(true)}
                >
                  Forgot password?
                </button>
              </div>
              <Button
                type="submit"
                size="lg"
                iconAfter="arrowRight"
                className="login-submit"
              >
                Continue to workspace
              </Button>
            </form>
          ) : (
            <form className="login-form login-form--signup" onSubmit={submitSignup}>
              <TextField
                label="Full name"
                value={signupName}
                onChange={(event) => setSignupName(event.target.value)}
                icon="userPlus"
              />
              <TextField
                label="Email address"
                value={signupEmail}
                onChange={(event) => setSignupEmail(event.target.value)}
                type="email"
                icon="mail"
              />
              <label className="field">
                <span className="field__label">Password</span>
                <span className="input-wrap">
                  <Icon name="lock" size={16} />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={signupPassword}
                    onChange={(event) => setSignupPassword(event.target.value)}
                    aria-describedby="signup-password-hint"
                  />
                  <button
                    type="button"
                    className="input-action"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    <Icon name={showPassword ? "eyeOff" : "eye"} size={16} />
                  </button>
                </span>
                <span className="field__hint" id="signup-password-hint">
                  Use at least 8 characters.
                </span>
              </label>
              <Button
                type="submit"
                size="lg"
                iconAfter="arrowRight"
                className="login-submit"
              >
                Create customer account
              </Button>
            </form>
          )}
          {error && <p className="form-error">{error}</p>}
          <div className="login-card__switch">
            <span>
              {authMode === "login"
                ? "Need a customer account?"
                : "Already have an account?"}
            </span>
            <button
              type="button"
              className="link-button"
              onClick={() => switchAuthMode(authMode === "login" ? "signup" : "login")}
            >
              {authMode === "login" ? "Register" : "Sign in"}
            </button>
          </div>
        </div>
      </main>

      <Modal
        open={recoveryOpen}
        title="Reset your password"
        description="We’ll send a reset link to the email on your account."
        onClose={() => setRecoveryOpen(false)}
      >
        <form className="modal-form" onSubmit={sendRecovery}>
          <TextField
            label="Email address"
            type="email"
            value={recoveryEmail}
            onChange={(event) => setRecoveryEmail(event.target.value)}
            icon="mail"
          />
          <div className="modal-actions">
            <Button
              variant="secondary"
              type="button"
              onClick={() => setRecoveryOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" icon="mail">
              Send reset link
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
