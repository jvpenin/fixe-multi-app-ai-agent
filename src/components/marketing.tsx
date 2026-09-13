"use client";
import Image from "next/image";
import { useState } from "react";
import { motion } from "framer-motion";
import { AppIcon } from "./app-icon";
import { Brand } from "./brand";
import { Icon } from "./ui-icon";
export type Persona = "student" | "professional" | "explorer";
const personas = [
  {
    id: "student" as const,
    label: "A new semester",
    kicker: "FOR THE CAMPUS YOU HAVEN’T FOUND YET.",
    description:
      "New campus. New people. New everything. Find your coffee spot, stock your room, and get settled before your first class.",
    note: "Less move-in admin. More main-character energy.",
  },
  {
    id: "professional" as const,
    label: "A new job",
    kicker: "FOR LIFE BEYOND YOUR FIRST DAY.",
    description:
      "You’ve landed the job. We’ll help with the rest: food near your place, room in your calendar, and the essentials for a fresh start.",
    note: "Your first week deserves a head start.",
  },
  {
    id: "explorer" as const,
    label: "A fresh start",
    kicker: "FOR THE CHAPTER YOU CHOSE YOURSELF.",
    description:
      "Different city. Still your taste. Discover the everyday places and little routines that make somewhere new feel like you.",
    note: "Pack your curiosity. We’ll take it from here.",
  },
];
export function Marketing({
  onStart,
  onDemo,
}: {
  onStart: (persona: Persona) => void;
  onDemo: () => void;
}) {
  const [persona, setPersona] = useState<Persona>("student");
  const active = personas.find((p) => p.id === persona)!;
  return (
    <motion.main
      className="marketing"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, y: -24 }}
      transition={{ duration: 0.35 }}
    >
      <section className="editorial-hero">
        <div className="hero-editorial-copy">
          <div className="eyebrow">
            <span className="orange-dot" /> YOUR NEXT CHAPTER STARTS HERE
          </div>
          <h1>
            New city.
            <br />
            Make it
            <br />
            <span className="hero-last-line">
              yours.
              <svg viewBox="0 0 180 90" aria-hidden="true">
                <path d="M8 67C48 18 107 9 151 32M133 8l25 27-36 7" />
              </svg>
            </span>
          </h1>
          <div
            className="persona-switch"
            aria-label="What brings you to a new city?"
          >
            {personas.map((p) => (
              <button
                key={p.id}
                aria-pressed={p.id === persona}
                onClick={() => setPersona(p.id)}
              >
                {p.label}
              </button>
            ))}
          </div>
          <p className="persona-description" aria-live="polite">
            {active.description}
          </p>
          <div className="hero-actions">
            <button className="primary" onClick={() => onStart(persona)}>
              Plan my arrival <Icon name="arrow" />
            </button>
            <button className="demo-link" onClick={onDemo}>
              <span className="play-icon">▶</span> Take a look inside
            </button>
          </div>
          <div className="hero-fine">
            <Icon name="check" size={14} /> Your budget. Your taste. Always your
            call.
          </div>
        </div>
        <div className="hero-photo-composition">
          <div className="photo-frame">
            <Image
              src="/images/san-francisco-editorial.png"
              alt="Sunlit Victorian homes on a San Francisco hill, looking toward the bay"
              fill
              priority
              sizes="(max-width: 760px) 90vw, 48vw"
            />
            <div className="photo-grain" />
            <div className="photo-location">
              <span className="location-dot" /> SAN FRANCISCO, CA{" "}
              <span>37.7749° N 122.4194° W</span>
            </div>
            <div className="photo-bottom-copy">
              Somewhere new.
              <br />
              Something good.
            </div>
          </div>
          <div className="seventy-stamp">
            <strong>72</strong>
            <span>
              HOURS.
              <br />
              ALL YOURS.
            </span>
            <svg viewBox="0 0 70 70" aria-hidden="true">
              <path d="M12 35h45m-16-16 17 16-17 16" />
            </svg>
          </div>
          <motion.div
            className="arrival-ticket"
            initial={{ y: 20, rotate: -4, opacity: 0 }}
            animate={{ y: 0, rotate: -4, opacity: 1 }}
            transition={{ delay: 0.25, duration: 0.6 }}
          >
            <div className="ticket-topline">
              <span>
                <Icon name="plane" size={16} /> A GOOD PLACE TO START
              </span>
              <span>01 / 03</span>
            </div>
            <div className="ticket-title">
              Your first day,
              <br />
              with a little less figuring out.
            </div>
            <div className="ticket-stops">
              <div>
                <span className="stop-icon">
                  <Icon name="coffee" size={17} />
                </span>
                <div>
                  <strong>Find your coffee spot</strong>
                  <small>Something that feels familiar.</small>
                </div>
                <Icon name="arrow" size={15} />
              </div>
              <div>
                <span className="stop-icon">
                  <Icon name="bag" size={17} />
                </span>
                <div>
                  <strong>Get the essentials in</strong>
                  <small>Make a room feel like your room.</small>
                </div>
                <Icon name="arrow" size={15} />
              </div>
            </div>
            <div className="ticket-bottom">
              <span>AN EXAMPLE OF WHAT’S POSSIBLE</span>
              <span>LAND.AI ↗</span>
            </div>
          </motion.div>
          <span className="photo-side-note">
            A DIFFERENT ZIP CODE. THE SAME YOU.
          </span>
        </div>
      </section>
      <section className="connected-ribbon" id="integrations">
        <span>
          THREE APPS.
          <br />
          <strong>One less thing on your mind.</strong>
        </span>
        <div>
          {[
            {
              id: "google-maps",
              name: "Google Maps",
              role: "Your neighborhood",
            },
            {
              id: "google-calendar",
              name: "Google Calendar",
              role: "Your time",
            },
            { id: "zinc", name: "Zinc", role: "Your essentials" },
          ].map((a) => (
            <div className="ribbon-app" key={a.id}>
              <AppIcon id={a.id} />
              <div>
                <strong>{a.name}</strong>
                <small>{a.role}</small>
              </div>
            </div>
          ))}
        </div>
        <span className="ribbon-arrow">
          <Icon name="arrow" size={28} />
        </span>
      </section>
      <section className="chapter-section" id="how-it-works">
        <div className="section-heading">
          <div>
            <span className="eyebrow">THE FIRST 72 HOURS, REIMAGINED</span>
            <h2>
              Less “where do I start?”
              <br />
              More <span>“I’ve got this.”</span>
            </h2>
          </div>
          <p>
            You handle the big move.
            <br />
            We connect the small things that matter.
          </p>
        </div>
        <div className="chapter-grid">
          <article className="chapter-card chapter-context">
            <div className="chapter-number">
              01 <span>YOUR WORLD</span>
            </div>
            <div className="context-visual">
              <div className="context-city">
                <Icon name="pin" size={20} />
                <span>New city. Your address.</span>
              </div>
              <div className="context-tags">
                <span>☕ Coffee person</span>
                <span>↗ On foot</span>
                <span>$ Student budget</span>
                <span>✳ A little outdoorsy</span>
              </div>
            </div>
            <h3>
              A little about you.
              <br />A plan that gets you.
            </h3>
            <p>
              Share your address, a few favorite places, and what you want to
              spend. We’ll start there.
            </p>
          </article>
          <article className="chapter-card chapter-plan">
            <div className="chapter-number">
              02 <span>YOUR FIRST THREE DAYS</span>
            </div>
            <div className="mini-days">
              <span>
                <i>01</i> Land <Icon name="pin" size={15} />
              </span>
              <span>
                <i>02</i> Settle <Icon name="bag" size={15} />
              </span>
              <span>
                <i>03</i> Live <Icon name="coffee" size={15} />
              </span>
            </div>
            <h3>
              Your neighborhood.
              <br />
              Meet your calendar.
            </h3>
            <p>
              Places that fit your taste, time to settle, and an essentials
              cart. Together in one clear plan.
            </p>
          </article>
          <article className="chapter-card chapter-approval">
            <div className="chapter-number">
              03 <span>YOUR GO-AHEAD</span>
            </div>
            <div className="approval-visual">
              <div className="big-check">
                <Icon name="check" size={40} />
              </div>
              <span>You’re in control.</span>
            </div>
            <h3>
              You say go.
              <br />
              We make the moves.
            </h3>
            <p>
              Review first. Then approve Calendar events and a Zinc sandbox
              order. Every result, visible.
            </p>
          </article>
        </div>
      </section>
      <section className="next-chapter-banner">
        <div className="banner-scribble" aria-hidden="true">
          ↗
        </div>
        <div>
          <span className="eyebrow">
            FOR STUDENTS. FIRST JOBS. FRESH STARTS.
          </span>
          <h2>
            You didn’t move
            <br />
            to stay in your room.
          </h2>
          <p>{active.note}</p>
        </div>
        <button className="primary" onClick={() => onStart(persona)}>
          Let’s get you settled <Icon name="arrow" />
        </button>
      </section>
      <footer className="marketing-footer">
        <Brand
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        />
        <span>New places. More possibilities.</span>
        <div>
          <span>MAPS + CALENDAR + ZINC</span>
          <button className="text-button" onClick={onDemo}>
            Explore the demo <Icon name="arrow" size={14} />
          </button>
        </div>
      </footer>
    </motion.main>
  );
}
