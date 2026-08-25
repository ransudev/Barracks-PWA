"use client";

import { useState } from "react";
import { Button, Logo } from "@/app/components/ui";
import type { ViewId } from "@/app/types/domain";

export function PublicHeader({ go }: { go: (view: ViewId) => void }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <header className="public-header">
      <nav className="public-nav" aria-label="Primary navigation">
        <Logo onClick={() => go("landing")} />
        <div className="public-nav__links">
          <a className="is-active" href="#home">Home</a>
          <a href="#services">Services</a>
          <a href="#barbers">Barbers</a>
          <a href="#branches">Branches</a>
          <a href="#about">About</a>
          <a href="#contact">Contact</a>
        </div>
        <div className="public-nav__actions">
          <button className="public-nav__login" type="button" onClick={() => go("login")}>
            Login
          </button>
          <Button
            size="sm"
            icon="calendar"
            onClick={() => go("customer")}
            className="public-nav__book"
          >
            Book Appointment
          </Button>
          <button
            className="public-nav__menu-toggle"
            type="button"
            aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-controls="public-mobile-menu"
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen((open) => !open)}
          >
            <span aria-hidden="true" />
            <span aria-hidden="true" />
            <span aria-hidden="true" />
          </button>
        </div>
      </nav>
      {mobileMenuOpen ? (
        <div className="public-mobile-menu" id="public-mobile-menu">
          <div className="public-mobile-menu__links">
            <a href="#home" onClick={closeMobileMenu}>Home</a>
            <a href="#services" onClick={closeMobileMenu}>Services</a>
            <a href="#barbers" onClick={closeMobileMenu}>Barbers</a>
            <a href="#branches" onClick={closeMobileMenu}>Branches</a>
            <a href="#about" onClick={closeMobileMenu}>About</a>
            <a href="#contact" onClick={closeMobileMenu}>Contact</a>
          </div>
          <div className="public-mobile-menu__actions">
            <button type="button" onClick={() => { closeMobileMenu(); go("login"); }}>Login</button>
            <Button size="sm" icon="calendar" onClick={() => { closeMobileMenu(); go("customer"); }}>
              Book Appointment
            </Button>
          </div>
        </div>
      ) : null}
    </header>
  );
}
