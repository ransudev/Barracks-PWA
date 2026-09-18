"use client";

import { useState, type FormEvent } from "react";
import Image from "next/image";
import type { ViewId } from "@/app/types/domain";
import { Button, Logo, Modal, TextField } from "@/app/components/ui";
import { Icon } from "@/app/components/ui/icons";
import { landingContact, landingHours } from "@/app/data/landing";
import {
  apiRequest,
  readApiBody,
  type ApiErrorBody,
  type ApiUser,
} from "@/app/lib/api";

type LoginPageProps = {
  go: (view: ViewId) => void;
  onLogin: (user: ApiUser) => void;
};

type AuthMode = "login" | "signup";

export function LoginPage({ go, onLogin }: LoginPageProps) {
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupPhone, setSignupPhone] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [recoveryOpen, setRecoveryOpen] = useState(false);

  async function submit(event: FormEvent) {
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
    setSubmitting(true);

    try {
      const response = await apiRequest("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      const body = await readApiBody<
        | ({ success: true; user: ApiUser })
        | ApiErrorBody
      >(response);

      if (!response.ok || !body || !body.success) {
        const errorBody = body && !body.success ? body : null;
        const validationMessage = errorBody?.errors
          ? Object.values(errorBody.errors).flat().join(" ")
          : undefined;
        throw new Error(
          validationMessage ?? errorBody?.message ?? "Unable to sign in",
        );
      }

      onLogin(body.user);
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Unable to sign in",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function submitSignup(event: FormEvent) {
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

    const nameParts = name.split(/\s+/);
    const firstName = nameParts.shift() ?? "";
    const lastName = nameParts.join(" ") || "Customer";
    setError("");
    setSubmitting(true);

    try {
      const response = await apiRequest("/api/auth/signup", {
        method: "POST",
        body: JSON.stringify({
          firstName,
          lastName,
          email: accountEmail,
          password: signupPassword,
          phone: signupPhone,
          preferredBarberId: null,
        }),
      });
      const body = await readApiBody<{ success: boolean; user?: ApiUser; message?: string; errors?: Record<string, string[]> }>(response);
      if (!response.ok || !body?.success || !body.user) {
        const validationMessage = body?.errors ? Object.values(body.errors).flat().join(" ") : undefined;
        throw new Error(validationMessage ?? body?.message ?? "Unable to create customer account");
      }
      onLogin(body.user);
    } catch (signupError) {
      setError(signupError instanceof Error ? signupError.message : "Unable to create customer account");
    } finally {
      setSubmitting(false);
    }
  }

  function switchAuthMode(nextMode: AuthMode) {
    setAuthMode(nextMode);
    setError("");
  }

  return (
    <div className="login-page">
      <div className="login-page__aside">
        <div className="login-page__aside-bg">
          <Image
            src="/barracks/bangkal-interior-enhanced.png"
            alt="Barracks Barbershop interior"
            fill
            priority
            sizes="(max-width: 960px) 100vw, 460px"
          />
        </div>
        <div className="login-page__aside-overlay" />

        <div className="login-page__aside-content">
          <div>
            <button
              className="login-back"
              type="button"
              onClick={() => go("landing")}
            >
              <Icon name="chevronLeft" size={14} />
              <span>Back to Barracks</span>
            </button>

            <div className="login-aside__brand">
              <Logo />
            </div>
          </div>

          <div className="login-aside__crest">
            <div className="login-aside__crest-badge">
              <Icon name="scissors" size={12} />
              <span>EST. 2017 · DAVAO CITY</span>
            </div>
            <h2>
              GIVING A MODERN TWIST <br />
              <span className="accent-crimson">TO A TRADITIONAL BARBERSHOP.</span>
            </h2>
          </div>

          <div className="login-aside__footer">
            <div className="login-aside__footer-row">
              <span>OPERATING HOURS</span>
              <strong>{landingHours.label}</strong>
            </div>
            <div className="login-aside__footer-row">
              <span>SHOP HOTLINE</span>
              <strong>{landingContact.phone}</strong>
            </div>
            <div className="login-aside__footer-row">
              <span>COMMUNITY</span>
              <strong>{landingContact.hashtag}</strong>
            </div>
          </div>
        </div>
      </div>

      <main className="login-page__main">
        <div className="login-card">
          {/* Segmented Auth Switcher */}
          <div className="auth-segmented-switch" role="tablist" aria-label="Sign in or register">
            <button
              type="button"
              role="tab"
              aria-selected={authMode === "login"}
              className={`auth-segmented-btn ${authMode === "login" ? "is-active" : ""}`}
              onClick={() => switchAuthMode("login")}
            >
              <Icon name="lock" size={14} />
              <span>Sign In</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={authMode === "signup"}
              className={`auth-segmented-btn ${authMode === "signup" ? "is-active" : ""}`}
              onClick={() => switchAuthMode("signup")}
            >
              <Icon name="userPlus" size={14} />
              <span>Register</span>
            </button>
          </div>

          <div className="login-card__head">
            <span className="login-card__eyebrow">
              <Icon name={authMode === "login" ? "spark" : "userPlus"} size={13} />
              <span>{authMode === "login" ? "ACCOUNT ACCESS" : "NEW CLIENT REGISTRATION"}</span>
            </span>
            <h1>
              {authMode === "login" ? (
                <>WELCOME <span className="accent-crimson">BACK.</span></>
              ) : (
                <>JOIN THE <span className="accent-crimson">BARRACKS.</span></>
              )}
            </h1>
          </div>

          {authMode === "login" ? (
            <form className="login-form" onSubmit={submit}>
              <TextField
                label="Email address"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                icon="mail"
                required
              />
              <label className="field">
                <span className="field__label">Password <span aria-hidden="true">*</span></span>
                <span className="input-wrap">
                  <Icon name="lock" size={16} />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
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
                <span className="login-form__session-note">Sessions remain active 7 days.</span>
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
                disabled={submitting}
              >
                {submitting ? "Signing in…" : "Continue to workspace"}
              </Button>
            </form>
          ) : (
            <form className="login-form login-form--signup" onSubmit={submitSignup}>
              <TextField
                label="Full name"
                value={signupName}
                onChange={(event) => setSignupName(event.target.value)}
                icon="userPlus"
                required
              />
              <TextField
                label="Email address"
                value={signupEmail}
                onChange={(event) => setSignupEmail(event.target.value)}
                type="email"
                icon="mail"
                required
              />
              <TextField
                label="Phone number"
                value={signupPhone}
                onChange={(event) => setSignupPhone(event.target.value)}
                icon="phone"
                placeholder="+63 917 000 0000"
              />
              <label className="field">
                <span className="field__label">Password <span aria-hidden="true">*</span></span>
                <span className="input-wrap">
                  <Icon name="lock" size={16} />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={signupPassword}
                    onChange={(event) => setSignupPassword(event.target.value)}
                    aria-describedby="signup-password-hint"
                    required
                    minLength={8}
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
                disabled={submitting}
              >
                {submitting ? "Creating account…" : "Create customer account"}
              </Button>
            </form>
          )}

          {error && <p className="form-error" role="alert">{error}</p>}

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
        title="Sign-in help"
        description="Password reset is not available in Sprint 1."
        onClose={() => setRecoveryOpen(false)}
      >
        <div className="modal-form">
          <p className="modal-copy">Contact an administrator or visit any of our 4 Davao HQs if you need your access restored.</p>
          <div className="modal-actions">
            <Button type="button" onClick={() => setRecoveryOpen(false)}>
              Close
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
