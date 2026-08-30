"use client";

import { useState } from "react";
import { Button, Logo } from "@/app/components/ui";
import { Icon } from "@/app/components/ui/icons";
import type { ViewId } from "@/app/types/domain";

export function PublicHeader({ go }: { go: (view: ViewId) => void }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const closeMobileMenu = () => setMobileMenuOpen(false);
  const closeAboutMenu = () => setAboutOpen(false);

  return (
    <header className="public-header">
      <nav className="public-nav" aria-label="Primary navigation">
        <Logo onClick={() => go("landing")} />
        <div className="public-nav__links">
          <a className="is-active" href="#home">Home</a>
          <div className="public-nav__dropdown">
            <button
              className="public-nav__dropdown-trigger"
              type="button"
              aria-expanded={aboutOpen}
              aria-haspopup="true"
              onClick={() => setAboutOpen((open) => !open)}
            >
              About <Icon name="chevronDown" size={13} />
            </button>
            {aboutOpen ? (
              <div className="public-nav__dropdown-menu">
                <a href="#about" onClick={closeAboutMenu}>About Barracks</a>
                <a href="#services" onClick={closeAboutMenu}>Services</a>
                <a href="#branches" onClick={closeAboutMenu}>Branches</a>
              </div>
            ) : null}
          </div>
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
            <div className="public-mobile-menu__about">
              <button
                type="button"
                aria-expanded={aboutOpen}
                onClick={() => setAboutOpen((open) => !open)}
              >
                About <Icon name="chevronDown" size={13} />
              </button>
              {aboutOpen ? (
                <div className="public-mobile-menu__sub-links">
                  <a href="#about" onClick={() => { closeMobileMenu(); closeAboutMenu(); }}>About Barracks</a>
                  <a href="#services" onClick={() => { closeMobileMenu(); closeAboutMenu(); }}>Services</a>
                  <a href="#branches" onClick={() => { closeMobileMenu(); closeAboutMenu(); }}>Branches</a>
                </div>
              ) : null}
            </div>
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
