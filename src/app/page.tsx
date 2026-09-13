"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion, MotionConfig } from "framer-motion";
import { AppIcon } from "@/components/app-icon";
import { DestinationAddress } from "@/components/destination-address";
import {
  emptyAddress,
  CompleteAddressSchema,
  formatAddress,
  type AddressFields,
} from "@/agent/address";
import { Brand } from "@/components/brand";
import { Icon } from "@/components/ui-icon";
import { Marketing, type Persona } from "@/components/marketing";
import { JourneyCard } from "@/components/journey-card";
import { Landy } from "@/components/city-scene";
import { PlaceInput, type PlaceChoice } from "@/components/place-input";
import {
  LandingPlanSchema,
  ExecuteResponseSchema,
  type LandingPlan,
  type ActionResult,
  type ToolTraceEntry,
  type TransportationMode,
} from "@/agent/schemas";
import demoProfile from "@/fixtures/demo-profile.json";

type Screen = "home" | "onboarding" | "running" | "plan" | "execution";
type Connection = {
  status: "waiting" | "running" | "connected" | "failed";
  error?: string;
};
const apps = [
  {
    id: "google-maps",
    name: "Google Maps",
    icon: "⌖",
    detail: "Find your kind of places, right around the corner.",
  },
  {
    id: "google-calendar",
    name: "Google Calendar",
    icon: "▦",
    detail: "Make room for new things. Keep your existing plans.",
  },
  {
    id: "zinc",
    name: "Zinc",
    icon: "z",
    detail: "Prepare the little essentials that make a place feel like home.",
  },
];
const interests = [
  "Coffee",
  "Food",
  "Nightlife",
  "Outdoors",
  "Fitness",
  "Culture",
  "Shopping",
];
const money = (amount: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    amount,
  );
const firstName = (name: string) => name.trim().split(" ")[0] || "friend";
function Trace({ entries }: { entries: ToolTraceEntry[] }) {
  return (
    <details className="trace">
      <summary>
        Agent trace <span>{entries.length} API responses</span>
      </summary>
      {entries.length === 0 ? (
        <p>Sample fixtures loaded. No live API calls were made.</p>
      ) : (
        entries.map((t, i) => (
          <div key={i}>
            <span className={t.status === "failed" ? "error-text" : ""}>
              {t.status === "success" ? "✓" : t.status === "failed" ? "!" : "○"}{" "}
              {t.tool} · {t.operation}
            </span>
            <small>
              {t.status} · {t.durationMs} ms · attempt {t.attempt}
            </small>
            {t.errorCode && <small className="error-text">{t.errorCode}</small>}
          </div>
        ))
      )}
    </details>
  );
}

export default function Home() {
  const [screen, setScreen] = useState<Screen>("home");
  const [step, setStep] = useState(0);
  const [demo, setDemo] = useState(false);
  const [name, setName] = useState("");
  const [city, setCity] = useState("San Francisco, CA");
  const [address, setAddress] = useState("");
  const [addressFields, setAddressFields] = useState<AddressFields>({
    ...emptyAddress,
  });
  const [destinationPlace, setDestinationPlace] = useState<PlaceChoice | null>(
    null,
  );
  const [arrival, setArrival] = useState("2026-09-15T10:45");
  const [budget, setBudget] = useState(150);
  const [mobility, setMobility] = useState<TransportationMode>("walking");
  const [diet, setDiet] = useState("");
  const [selectedInterests, setSelectedInterests] = useState([
    "Coffee",
    "Food",
    "Outdoors",
  ]);
  const [learning, setLearning] = useState(false);
  const [learnedPreferences, setLearnedPreferences] = useState<string[]>([]);
  const [preferenceNote, setPreferenceNote] = useState("");
  const [avatar, setAvatar] = useState("");
  const [favoriteQuery, setFavoriteQuery] = useState("");
  const [favorites, setFavorites] = useState<PlaceChoice[]>([]);
  const [connections, setConnections] = useState<Record<string, Connection>>(
    {},
  );
  const [plan, setPlan] = useState<LandingPlan | null>(null);
  const [error, setError] = useState("");
  const [selectedActions, setSelectedActions] = useState<string[]>([]);
  const [excludedItems, setExcludedItems] = useState<string[]>([]);
  const [results, setResults] = useState<ActionResult[]>([]);
  const [executionTrace, setExecutionTrace] = useState<ToolTraceEntry[]>([]);
  const [executing, setExecuting] = useState(false);
  const [tab, setTab] = useState("My plan");
  const [day, setDay] = useState(0);
  const busy = useRef(false);
  const start = () => {
    setScreen("onboarding");
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const startForPersona = (persona: Persona) => {
    setDemo(false);
    setStep(0);
    setError("");
    setCity("");
    setAddress("");
    setAddressFields({ ...emptyAddress });
    setDestinationPlace(null);
    setName("");
    setFavorites([]);
    setLearnedPreferences([]);
    setPreferenceNote("");
    setBudget(
      persona === "professional" ? 250 : persona === "explorer" ? 200 : 150,
    );
    setSelectedInterests(
      persona === "professional"
        ? ["Coffee", "Food", "Fitness"]
        : persona === "explorer"
          ? ["Culture", "Outdoors", "Food"]
          : ["Coffee", "Food", "Outdoors"],
    );
    start();
  };
  const useDemo = () => {
    setDemo(true);
    setName("Alex");
    setCity(demoProfile.destination);
    setAddress(demoProfile.approximateAddress);
    setArrival("2026-09-15T14:00");
    setFavorites(
      demoProfile.favoritePlaceIds.map((placeId, i) => ({
        placeId,
        text: ["Trader Joe’s", "Tatte Bakery", "Flour Bakery"][i] ?? placeId,
      })),
    );
    setStep(1);
    start();
  };
  async function connect(id: string) {
    setConnections((c) => ({ ...c, [id]: { status: "running" } }));
    try {
      const res = await fetch("/api/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ integration: id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setConnections((c) => ({ ...c, [id]: { status: "connected" } }));
    } catch (e) {
      setConnections((c) => ({
        ...c,
        [id]: {
          status: "failed",
          error: e instanceof Error ? e.message : "Connection failed",
        },
      }));
    }
  }
  async function learnPreferences() {
    if (learning) return;
    setLearning(true);
    setPreferenceNote("");
    setLearnedPreferences([]);
    try {
      const res = await fetch("/api/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          placeIds: favorites.map((f) => f.placeId),
          demoMode: demo,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setLearnedPreferences(data.preferences);
      if (data.partial)
        setPreferenceNote(
          "Some place details were unavailable. These suggestions use the places we could check.",
        );
    } catch (e) {
      setPreferenceNote(
        e instanceof Error
          ? e.message
          : "Place details unavailable. Your selected interests will be used.",
      );
    } finally {
      setLearning(false);
      setStep(3);
    }
  }
  async function buildPlan() {
    if (busy.current) return;
    busy.current = true;
    setError("");
    setScreen("running");
    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destination: city,
          approximateAddress: address,
          destinationAddress: demo ? undefined : addressFields,
          destinationPlaceId: destinationPlace?.placeId,
          arrivalAt: new Date(arrival).toISOString(),
          budget,
          favoritePlaceIds: favorites.map((f) => f.placeId),
          preferenceOverrides: {
            dietaryRestrictions: diet
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
            transportation: mobility,
            interests: [...selectedInterests, ...learnedPreferences].map((s) =>
              s.toLowerCase(),
            ),
          },
          demoMode: demo,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not build your plan.");
      const next = LandingPlanSchema.parse(data);
      setPlan(next);
      setResults([]);
      setExecutionTrace([]);
      setExcludedItems([]);
      setSelectedActions(next.proposedActions.map((a) => a.actionId));
      setTab("My plan");
      setScreen("plan");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Something went wrong. Please retry.",
      );
      setScreen("onboarding");
      setStep(3);
    } finally {
      busy.current = false;
    }
  }
  async function execute(ids = selectedActions) {
    if (!plan || busy.current || !ids.length) return;
    busy.current = true;
    setExecuting(true);
    setScreen("execution");
    setError("");
    try {
      await Promise.all(
        ids.map(async (actionId) => {
          try {
            const res = await fetch("/api/execute", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                planId: plan.planId,
                approvedActionIds: [actionId],
                excludedEssentialIds: excludedItems,
              }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Execution failed");
            const response = ExecuteResponseSchema.parse(data);
            setResults((prev) => [
              ...prev.filter((r) => r.actionId !== actionId),
              ...response.results,
            ]);
            setExecutionTrace((prev) => [...prev, ...response.trace]);
          } catch (e) {
            setError(
              e instanceof Error ? e.message : "Connection lost. Retry safely.",
            );
          }
        }),
      );
    } finally {
      busy.current = false;
      setExecuting(false);
    }
  }
  const cart =
    plan?.essentials.filter(
      (i) => i.available && !excludedItems.includes(i.productId),
    ) ?? [];
  const total = cart.reduce((s, i) => s + (i.priceCents * i.quantity) / 100, 0);
  const completed = results.filter((r) => r.status === "success");
  const allComplete =
    selectedActions.length > 0 &&
    selectedActions.every((id) =>
      results.some((r) => r.actionId === id && r.status === "success"),
    );
  const toggleAction = (id: string) =>
    setSelectedActions((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id],
    );
  const integrationCards = (
    <div className="integration-cards">
      {apps.map((app) => {
        const connection = connections[app.id];
        return (
          <article
            key={app.id}
            className={`integration-card ${connection?.status === "connected" ? "is-connected" : ""}`}
          >
            <AppIcon id={app.id} />
            <h3>
              {app.name}{" "}
              {app.id === "zinc" && <span className="tag">Sandbox</span>}
            </h3>
            <p>{app.detail}</p>
            {demo ? (
              <span className="sample-status">Sample data enabled</span>
            ) : (
              <button
                className="secondary small"
                disabled={
                  connection?.status === "running" ||
                  connection?.status === "connected"
                }
                onClick={() => connect(app.id)}
              >
                {connection?.status === "running"
                  ? "Checking connection…"
                  : connection?.status === "connected"
                    ? "✓ Connected"
                    : connection?.status === "failed"
                      ? "Retry connection ↗"
                      : app.id === "zinc"
                        ? "Enable sandbox ↗"
                        : "Connect Google ↗"}
              </button>
            )}
            {connection?.error && (
              <small className="error-text">{connection.error}</small>
            )}
            {connection?.status === "connected" && (
              <motion.div
                initial={{ x: -50, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
              >
                <Landy className="connection-landy" />
              </motion.div>
            )}
          </article>
        );
      })}
    </div>
  );
  return (
    <MotionConfig reducedMotion="user">
      <div className={`site ${screen !== "home" ? "in-app" : ""}`}>
        <header className="nav">
          <Brand
            onClick={() => {
              if (!executing) setScreen("home");
            }}
          />
          {screen === "home" ? (
            <nav>
              <a href="#how-it-works">The first 72 hours</a>
              <a href="#integrations">Integrations</a>
              <button
                className="nav-cta"
                onClick={() => startForPersona("student")}
              >
                Plan my arrival <Icon name="arrow" size={17} />
              </button>
            </nav>
          ) : (
            <div className="nav-context">
              <span className="live-dot" />
              {demo
                ? "Sample landing · no live writes"
                : "A new city. A plan that gets you."}
              <button
                className="text-button"
                disabled={executing}
                onClick={() => setScreen("home")}
              >
                Close ×
              </button>
            </div>
          )}
        </header>
        <AnimatePresence mode="wait">
          {screen === "home" && (
            <Marketing key="home" onStart={startForPersona} onDemo={useDemo} />
          )}
          {screen === "onboarding" && (
            <motion.main
              key="onboarding"
              className="onboarding"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <aside className="onboarding-sidebar">
                <span className="eyebrow">YOUR NEXT CHAPTER</span>
                <h2>
                  Let’s make
                  <br />
                  this your city.
                </h2>
                <ol>
                  {[
                    "Your destination",
                    "Your connections",
                    "A little about you",
                    "Ready for takeoff",
                  ].map((s, i) => (
                    <li
                      className={step === i ? "active" : step > i ? "done" : ""}
                      key={s}
                    >
                      <button
                        onClick={() => {
                          if (i < step) setStep(i);
                        }}
                        disabled={i > step}
                      >
                        <span>{step > i ? "✓" : `0${i + 1}`}</span>
                        {s}
                      </button>
                    </li>
                  ))}
                </ol>
                <div className="sidebar-note">
                  ✧
                  <p>
                    Made around you.
                    <br />
                    Always approved by you.
                  </p>
                </div>
                {!demo && (
                  <button className="text-button" onClick={useDemo}>
                    Try the sample landing ↗
                  </button>
                )}
              </aside>
              <section className="onboarding-center">
                <div className="step-counter">
                  STEP 0{step + 1} OF 04{" "}
                  <span>{Math.round((step + 1) * 25)}%</span>
                </div>
                <div className="progress-track">
                  <motion.div animate={{ width: `${(step + 1) * 25}%` }} />
                </div>
                {error && (
                  <div className="error-banner" role="alert">
                    {error}
                  </div>
                )}
                <AnimatePresence mode="wait">
                  <motion.div
                    key={step}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                  >
                    {step === 0 && (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (
                            demo ||
                            CompleteAddressSchema.safeParse(addressFields)
                              .success
                          )
                            setStep(1);
                        }}
                      >
                        <span className="step-symbol">
                          <Icon name="pin" size={26} />
                        </span>
                        <h2>Where are you landing?</h2>
                        <p className="intro">
                          Every good beginning starts somewhere.
                        </p>
                        {demo ? (
                          <div className="selected-location">
                            ⌖ {address}
                            <small className="field-help">
                              Recorded Boston sample location
                            </small>
                          </div>
                        ) : (
                          <DestinationAddress
                            value={addressFields}
                            onPlace={setDestinationPlace}
                            onChange={(next) => {
                              setAddressFields(next);
                              setAddress(formatAddress(next));
                              setCity(
                                [next.city, next.state, next.country]
                                  .filter(Boolean)
                                  .join(", "),
                              );
                            }}
                          />
                        )}
                        <small className="field-help">
                          Land.ai will plan everything around this location.
                        </small>
                        {destinationPlace && (
                          <a
                            className="selected-location"
                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}&query_place_id=${destinationPlace.placeId}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            ⌖ {address} <span>View map ↗</span>
                          </a>
                        )}
                        {(demo ||
                          CompleteAddressSchema.safeParse(addressFields)
                            .success) && (
                          <iframe
                            className="destination-preview"
                            title="Your selected destination"
                            src={`https://maps.google.com/maps?q=${encodeURIComponent(address)}&output=embed`}
                            loading="lazy"
                            referrerPolicy="no-referrer-when-downgrade"
                          />
                        )}
                        <div className="field">
                          <label htmlFor="arrival">
                            Arrival date & time{" "}
                            <small>(your device’s time zone)</small>
                          </label>
                          <input
                            id="arrival"
                            type="datetime-local"
                            required
                            value={arrival}
                            onChange={(e) => setArrival(e.target.value)}
                          />
                        </div>
                        <button
                          className="primary full"
                          disabled={
                            !city.trim() ||
                            (!demo &&
                              !CompleteAddressSchema.safeParse(addressFields)
                                .success) ||
                            !arrival
                          }
                        >
                          That’s my destination <span>→</span>
                        </button>
                      </form>
                    )}
                    {step === 1 && (
                      <>
                        <span className="step-symbol">
                          <Icon name="grid" size={26} />
                        </span>
                        <h2>Your apps. A new team.</h2>
                        <p className="intro">
                          Connect the apps Land.ai will work with.
                        </p>
                        {integrationCards}
                        <p className="field-help">
                          {demo
                            ? "Recorded Boston sample data. Connections and execution are simulated."
                            : "Uses the Google account configured on this server. Calendar checks your availability; Maps finds nearby places. Zinc uses sandbox orders only."}
                        </p>
                        <button
                          className="primary full"
                          onClick={() => setStep(2)}
                        >
                          Continue <span>→</span>
                        </button>
                        <p className="fine-print">
                          You’ll approve every Calendar event and sandbox order.
                        </p>
                      </>
                    )}
                    {step === 2 && (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          void learnPreferences();
                        }}
                      >
                        <span className="step-symbol">
                          <Icon name="user" size={26} />
                        </span>
                        <h2>Your city. Your kind of things.</h2>
                        <p className="intro">
                          Your kind of city starts with your kind of things.
                        </p>
                        <div className="avatar-options">
                          <label>
                            Choose an avatar <small>optional</small>
                          </label>
                          {["✧", "↗", "☀", "⌂"].map((symbol) => (
                            <button
                              type="button"
                              key={symbol}
                              aria-label={`Avatar ${symbol}`}
                              aria-pressed={avatar === symbol}
                              onClick={() => setAvatar(symbol)}
                              className={avatar === symbol ? "selected" : ""}
                            >
                              {symbol}
                            </button>
                          ))}
                        </div>
                        <div className="field-row">
                          <div className="field">
                            <label htmlFor="name">Full name</label>
                            <input
                              id="name"
                              required
                              value={name}
                              onChange={(e) => setName(e.target.value)}
                              placeholder="Your name"
                            />
                          </div>
                          <div className="field">
                            <label htmlFor="budget">72-hour budget (USD)</label>
                            <input
                              id="budget"
                              type="number"
                              min="0"
                              required
                              value={budget}
                              onChange={(e) =>
                                setBudget(Number(e.target.value))
                              }
                            />
                          </div>
                        </div>
                        <div className="field-row">
                          <div className="field">
                            <label htmlFor="mobility">Getting around</label>
                            <select
                              id="mobility"
                              value={mobility}
                              onChange={(e) =>
                                setMobility(
                                  e.target.value as TransportationMode,
                                )
                              }
                            >
                              <option value="walking">Walking</option>
                              <option value="public-transit">
                                Public transportation
                              </option>
                              <option value="car">Car / rideshare</option>
                              <option value="bike">Bike</option>
                            </select>
                          </div>
                          <div className="field">
                            <label htmlFor="diet">Dietary preferences</label>
                            <input
                              id="diet"
                              value={diet}
                              onChange={(e) => setDiet(e.target.value)}
                              placeholder="e.g. vegetarian, no nuts"
                            />
                          </div>
                        </div>
                        <label>Your interests</label>
                        <div className="chips">
                          {interests.map((i) => (
                            <button
                              type="button"
                              aria-pressed={selectedInterests.includes(i)}
                              className={
                                selectedInterests.includes(i) ? "selected" : ""
                              }
                              key={i}
                              onClick={() =>
                                setSelectedInterests((p) =>
                                  p.includes(i)
                                    ? p.filter((v) => v !== i)
                                    : [...p, i],
                                )
                              }
                            >
                              {i} {selectedInterests.includes(i) && "✓"}
                            </button>
                          ))}
                        </div>
                        <PlaceInput
                          label="Show Land.ai what you like · 3–5 favorite places"
                          value={favoriteQuery}
                          onChange={setFavoriteQuery}
                          onSelect={(p) => {
                            if (
                              favorites.length < 5 &&
                              !favorites.some((f) => f.placeId === p.placeId)
                            )
                              setFavorites((f) => [...f, p]);
                            setFavoriteQuery("");
                          }}
                          placeholder="Search a favorite café, restaurant or park"
                        />
                        <div className="favorite-list">
                          {favorites.map((p) => (
                            <button
                              key={p.placeId}
                              type="button"
                              onClick={() =>
                                setFavorites((f) =>
                                  f.filter((v) => v.placeId !== p.placeId),
                                )
                              }
                            >
                              {p.text} <span>×</span>
                            </button>
                          ))}
                        </div>
                        <small className="field-help">
                          Only the places you share. Never your private Maps
                          history.
                        </small>
                        <button
                          className="primary full"
                          disabled={
                            !name.trim() || favorites.length < 3 || learning
                          }
                        >
                          {learning
                            ? "Learning your preferences…"
                            : "This looks like me"}{" "}
                          <span>→</span>
                        </button>
                      </form>
                    )}
                    {step === 3 && (
                      <>
                        <span className="eyebrow">
                          {firstName(name).toUpperCase()}’S ARRIVAL PLAN
                        </span>
                        <h2>This is your starting point.</h2>
                        <p className="intro">
                          Check the details. We’ll connect the rest.
                        </p>
                        <div className="summary-card">
                          <h3>⌖ {city}</h3>
                          <p>{address}</p>
                          <dl>
                            <div>
                              <dt>Arriving</dt>
                              <dd>
                                {new Date(arrival).toLocaleString(undefined, {
                                  month: "long",
                                  day: "numeric",
                                  hour: "numeric",
                                  minute: "2-digit",
                                })}
                              </dd>
                            </div>
                            <div>
                              <dt>Your budget</dt>
                              <dd>{money(budget)}</dd>
                            </div>
                            <div>
                              <dt>Getting around</dt>
                              <dd>{mobility.replace("-", " ")}</dd>
                            </div>
                            <div>
                              <dt>Dietary preferences</dt>
                              <dd>{diet || "None specified"}</dd>
                            </div>
                          </dl>
                          <div className="chips">
                            {selectedInterests.map((i) => (
                              <span key={i}>{i}</span>
                            ))}
                          </div>
                          <div className="summary-connections">
                            {apps.map((a) => (
                              <span key={a.id}>
                                {demo
                                  ? "◇ Sample"
                                  : connections[a.id]?.status === "connected"
                                    ? "✓ Connected"
                                    : "○ Not verified"}{" "}
                                · {a.name}
                              </span>
                            ))}
                          </div>
                        </div>
                        {learnedPreferences.length > 0 && (
                          <div className="learned-preferences">
                            <h3>Does this look like you?</h3>
                            <p>
                              Based on{" "}
                              {demo
                                ? "the recorded sample places"
                                : "the places you shared"}
                              . Remove anything that doesn’t fit.
                            </p>
                            <div className="chips">
                              {learnedPreferences.map((p) => (
                                <button
                                  key={p}
                                  className="selected"
                                  onClick={() =>
                                    setLearnedPreferences((prev) =>
                                      prev.filter((v) => v !== p),
                                    )
                                  }
                                >
                                  {p} ×
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                        {preferenceNote && (
                          <p className="notice">{preferenceNote}</p>
                        )}
                        <p className="field-help">
                          Preferences confirmed from your selections.{" "}
                          {demo && "This run uses recorded Boston fixtures."}
                        </p>
                        <button className="primary full" onClick={buildPlan}>
                          Build my plan <span>↗</span>
                        </button>
                        <button
                          className="text-button back"
                          onClick={() => setStep(2)}
                        >
                          ← Edit my details
                        </button>
                      </>
                    )}
                  </motion.div>
                </AnimatePresence>
                {step > 0 && step < 3 && (
                  <button
                    className="text-button back"
                    onClick={() => setStep((s) => s - 1)}
                  >
                    ← Back
                  </button>
                )}
              </section>
              <aside className="trip-visual">
                <JourneyCard city={city} arrival={arrival} step={step} />
              </aside>
            </motion.main>
          )}
          {screen === "running" && (
            <motion.main
              key="running"
              className="running-screen"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <span className="eyebrow">
                YOUR FIRST 72 HOURS ARE TAKING SHAPE
              </span>
              <h2>
                Connecting your city.
                <br />
                One good thing at a time.
              </h2>
              <p>Finding your footing, before you even arrive.</p>
              <div className="agent-network">
                <motion.div
                  animate={{ x: [-70, 70, 0, -70], y: [30, 30, -40, 30] }}
                  transition={{ duration: 6, repeat: Infinity }}
                >
                  <Landy />
                </motion.div>
                {apps.map((a) => (
                  <div key={a.id}>
                    <AppIcon id={a.id} />
                    <span>{a.name}</span>
                  </div>
                ))}
              </div>
              <div className="running-steps" aria-live="polite">
                <p>
                  <span>✓</span> Destination received · {city}
                </p>
                <p>
                  <span className="pulse">↗</span>{" "}
                  {demo
                    ? "Loading the recorded sample landing…"
                    : `Checking Calendar, searching around ${address}, and preparing essentials…`}
                </p>
                <p className="muted">
                  ○ Waiting for the planner’s API response
                </p>
              </div>
              <small>
                {demo
                  ? "Demo mode · no live API calls"
                  : "Results and individual API traces appear as soon as the plan returns."}
              </small>
            </motion.main>
          )}
          {(screen === "plan" || screen === "execution") && plan && (
            <motion.main
              key="workspace"
              className="workspace"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <aside className="app-sidebar">
                <span className="eyebrow">YOUR NEW EVERYDAY</span>
                <nav>
                  {["My plan", "Map", "Essentials", "Integrations"].map(
                    (t, i) => (
                      <button
                        key={t}
                        className={tab === t ? "active" : ""}
                        onClick={() => {
                          setTab(t);
                          setScreen("plan");
                        }}
                      >
                        <Icon
                          name={
                            (["calendar", "pin", "bag", "grid"] as const)[i] ??
                            "grid"
                          }
                        />{" "}
                        <span>{t}</span>
                        {tab === t && "↗"}
                      </button>
                    ),
                  )}
                </nav>
                <button
                  className="user-profile"
                  disabled={executing}
                  onClick={() => {
                    setStep(2);
                    setScreen("onboarding");
                  }}
                >
                  <span className="avatar">{avatar || firstName(name)[0]}</span>
                  <span>
                    <strong>{firstName(name)}</strong>
                    <small>
                      {city} ·{" "}
                      {new Date(arrival).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </small>
                  </span>
                  <span>↗</span>
                </button>
              </aside>
              <section className="plan-content">
                {error && (
                  <div className="error-banner" role="alert">
                    {error}
                  </div>
                )}
                {demo && (
                  <div className="demo-banner">
                    ◇ Sample landing · recorded Boston data · execution is
                    simulated
                  </div>
                )}
                {screen === "execution" ? (
                  <div className="execution-view">
                    <Landy className="final-landy" />
                    <span className="eyebrow">
                      {executing
                        ? "PUTTING YOUR PLAN IN MOTION"
                        : "YOUR NEXT CHAPTER"}
                    </span>
                    <h2>
                      {executing
                        ? "Making it real."
                        : allComplete
                          ? "You’re ready to land."
                          : "Your landing is taking shape."}
                    </h2>
                    <p>
                      {allComplete
                        ? `Your approved actions for ${city} are complete.`
                        : "Every action, every confirmation. Right here."}
                    </p>
                    <div className="execution-results" aria-live="polite">
                      {plan.proposedActions
                        .filter((a) => selectedActions.includes(a.actionId))
                        .map((a) => {
                          const r = results.find(
                            (v) => v.actionId === a.actionId,
                          );
                          return (
                            <article key={a.actionId}>
                              <AppIcon id={a.integration} />
                              <div>
                                <strong>
                                  {a.integration === "zinc"
                                    ? `Sandbox test order · ${cart.length} essentials selected`
                                    : a.summary}
                                </strong>
                                <small>
                                  {r
                                    ? `${demo ? "Simulated · " : ""}${r.status === "success" ? "Confirmed" : r.status === "pending" ? "Submitted · awaiting confirmation" : "Failed"}`
                                    : executing
                                      ? "Executing…"
                                      : "No confirmation received"}
                                  {r?.externalId && ` · ${r.externalId}`}
                                </small>
                                {r?.errorCode && (
                                  <small className="error-text">
                                    {r.errorCode}
                                  </small>
                                )}
                              </div>
                              <span>
                                {r?.status === "success"
                                  ? "✓"
                                  : r?.status === "failed"
                                    ? "!"
                                    : "○"}
                              </span>
                              {!executing && (!r || r.retryable) && (
                                <button
                                  className="secondary small"
                                  onClick={() => execute([a.actionId])}
                                >
                                  Retry
                                </button>
                              )}
                            </article>
                          );
                        })}
                    </div>
                    <div className="result-stats">
                      <div>
                        <strong>
                          {
                            completed.filter(
                              (r) => r.integration === "google-calendar",
                            ).length
                          }
                        </strong>
                        <span>
                          {demo ? "simulated events" : "events scheduled"}
                        </span>
                      </div>
                      <div>
                        <strong>{plan.recommendations.length}</strong>
                        <span>places planned</span>
                      </div>
                      <div>
                        <strong>
                          {completed.some((r) => r.integration === "zinc")
                            ? cart.length
                            : 0}
                        </strong>
                        <span>essentials confirmed</span>
                      </div>
                    </div>
                    {results.some(
                      (r) => r.integration === "zinc" && r.status === "pending",
                    ) && (
                      <p className="notice">
                        The Zinc sandbox order was submitted. Final order
                        confirmation is still pending.
                      </p>
                    )}
                    <button
                      className="primary"
                      onClick={() => setScreen("plan")}
                    >
                      View my plan <span>→</span>
                    </button>
                    <Trace entries={executionTrace} />
                  </div>
                ) : (
                  <>
                    <div className="plan-heading">
                      <div>
                        <span className="eyebrow">
                          LESS PLANNING. MORE LIVING.
                        </span>
                        <h2>Your first 72 hours.</h2>
                        <p>
                          Hello, {firstName(name)}. Your landing in {city} is
                          ready to review.
                        </p>
                      </div>
                      <div className="destination-badge">
                        ⌖
                        <div>
                          <strong>{city}</strong>
                          <small>{address}</small>
                        </div>
                      </div>
                    </div>
                    {plan.warnings
                      .filter((w) => !w.startsWith("Demo mode"))
                      .map((w, i) => (
                        <div className="notice" key={i}>
                          {w}
                        </div>
                      ))}
                    {tab === "Integrations" ? (
                      <>
                        {integrationCards}
                        <Trace entries={[...plan.trace, ...executionTrace]} />
                      </>
                    ) : tab === "Map" ? (
                      <div className="map-panel">
                        <iframe
                          title="Your destination on Google Maps"
                          src={`https://maps.google.com/maps?q=${encodeURIComponent(address)}&output=embed`}
                          loading="lazy"
                          referrerPolicy="no-referrer-when-downgrade"
                        />
                        <div>
                          <h3>Your neighborhood, closer.</h3>
                          {plan.recommendations.map((p) => (
                            <a
                              key={p.placeId}
                              target="_blank"
                              rel="noreferrer"
                              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.name)}${demo ? "" : `&query_place_id=${p.placeId}`}`}
                            >
                              ⌖ {p.name} ↗
                            </a>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div
                        className={`plan-grid ${tab === "Essentials" ? "only-essentials" : ""}`}
                      >
                        {tab !== "Essentials" && (
                          <div>
                            <div className="day-tabs">
                              {["Land", "Settle", "Live"].map((d, i) => (
                                <button
                                  key={d}
                                  className={day === i ? "active" : ""}
                                  onClick={() => setDay(i)}
                                >
                                  DAY {i + 1}
                                  <strong>
                                    {d} <span>{["↘", "⌂", "✧"][i]}</span>
                                  </strong>
                                </button>
                              ))}
                            </div>
                            <div className="timeline">
                              {plan.proposedActions
                                .filter(
                                  (a) =>
                                    a.integration === "google-calendar" &&
                                    Math.floor(
                                      (Date.parse(String(a.payload.start)) -
                                        Date.parse(plan.arrivalAt)) /
                                        86400000,
                                    ) === day,
                                )
                                .map((a) => {
                                  const place = plan.recommendations.find(
                                    (p) => p.placeId === a.payload.placeId,
                                  );
                                  return (
                                    <article
                                      key={a.actionId}
                                      className="activity"
                                    >
                                      <div className="activity-time">
                                        <span>
                                          {new Date(
                                            String(a.payload.start),
                                          ).toLocaleTimeString(undefined, {
                                            hour: "numeric",
                                            minute: "2-digit",
                                          })}
                                        </span>
                                        <i />
                                      </div>
                                      <div className="activity-body">
                                        <div className="activity-category">
                                          {place?.category === "grocery"
                                            ? "THE LITTLE ESSENTIALS"
                                            : "A TASTE OF YOUR NEW CITY"}
                                          <input
                                            aria-label={`Approve ${a.summary}`}
                                            type="checkbox"
                                            checked={selectedActions.includes(
                                              a.actionId,
                                            )}
                                            disabled={
                                              executing || results.length > 0
                                            }
                                            onChange={() =>
                                              toggleAction(a.actionId)
                                            }
                                          />
                                        </div>
                                        <h3>{a.summary}</h3>
                                        <div className="activity-meta">
                                          <span>
                                            ⌖{" "}
                                            {place?.distanceMeters !== undefined
                                              ? `${(place.distanceMeters / 1000).toFixed(1)} km away`
                                              : "Distance unavailable"}
                                          </span>
                                          <span>
                                            {place?.priceLevel !== undefined
                                              ? "$".repeat(
                                                  Math.max(1, place.priceLevel),
                                                )
                                              : "Price unavailable"}
                                          </span>
                                          {place?.rating && (
                                            <span>☆ {place.rating}</span>
                                          )}
                                        </div>
                                        <p>
                                          {place
                                            ? `Selected using ${Object.keys(
                                                place.scoreBreakdown,
                                              )
                                                .map(
                                                  (signal) =>
                                                    ({
                                                      preferenceMatch:
                                                        "your interests",
                                                      affordability:
                                                        "affordability",
                                                      distance:
                                                        "distance from your stay",
                                                      rating: "guest ratings",
                                                      openAtProposedTime:
                                                        "available opening information",
                                                    })[signal] || signal,
                                                )
                                                .join(
                                                  ", ",
                                                )}. ${place.missingSignals.length ? `Not available: ${place.missingSignals.join(", ")}.` : ""}`
                                            : "A free time slot in your arrival window."}
                                        </p>
                                        <a
                                          className="maps-link"
                                          target="_blank"
                                          rel="noreferrer"
                                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place?.name || a.summary)}${!demo && place ? `&query_place_id=${place.placeId}` : ""}`}
                                        >
                                          <AppIcon id="google-maps" /> Open in
                                          Google Maps ↗
                                        </a>
                                      </div>
                                    </article>
                                  );
                                })}
                              {!plan.proposedActions.some(
                                (a) =>
                                  a.integration === "google-calendar" &&
                                  Math.floor(
                                    (Date.parse(String(a.payload.start)) -
                                      Date.parse(plan.arrivalAt)) /
                                      86400000,
                                  ) === day,
                              ) && (
                                <div className="empty-day">
                                  <span>✧</span>
                                  <h3>A little room to find your own way.</h3>
                                  <p>
                                    No activities scheduled for this day.
                                    Explore the places below at your own pace.
                                  </p>
                                </div>
                              )}
                            </div>
                            <div className="nearby-places">
                              <h3>
                                Around your corner{" "}
                                <span>
                                  {plan.recommendations.length} places
                                </span>
                              </h3>
                              {plan.recommendations.map((p) => (
                                <a
                                  key={p.placeId}
                                  target="_blank"
                                  rel="noreferrer"
                                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.name)}${demo ? "" : `&query_place_id=${p.placeId}`}`}
                                >
                                  <span>⌖</span>
                                  <div>
                                    <strong>{p.name}</strong>
                                    <small>
                                      {p.category}{" "}
                                      {p.rating ? `· ☆ ${p.rating}` : ""}
                                    </small>
                                  </div>
                                  <span>↗</span>
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                        <aside className="essentials-card">
                          <div className="essentials-header">
                            <span className="package-icon">▱</span>
                            <span className="tag">ZINC SANDBOX</span>
                          </div>
                          <h3>Arrival essentials</h3>
                          <p>Little things. One less thing to think about.</p>
                          <div className="cart-items">
                            {cart.map((item) => (
                              <div key={item.productId}>
                                <span>{item.quantity}×</span>
                                <span>{item.title}</span>
                                <strong>
                                  {money(
                                    (item.priceCents * item.quantity) / 100,
                                  )}
                                </strong>
                                <button
                                  aria-label={`Remove ${item.title}`}
                                  disabled={results.length > 0 || executing}
                                  onClick={() =>
                                    setExcludedItems((p) => [
                                      ...p,
                                      item.productId,
                                    ])
                                  }
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                            {!cart.length && <p>No essentials selected.</p>}
                          </div>
                          {excludedItems.length > 0 && (
                            <button
                              className="text-button"
                              disabled={results.length > 0 || executing}
                              onClick={() => setExcludedItems([])}
                            >
                              Restore removed items
                            </button>
                          )}
                          <div className="cart-total">
                            <span>Estimated total</span>
                            <strong>{money(total)}</strong>
                          </div>
                          <small>
                            Sandbox test order only. No real purchase or
                            delivery.
                          </small>
                        </aside>
                      </div>
                    )}
                    {tab !== "Integrations" && (
                      <div className="approval-card">
                        <div>
                          <span className="eyebrow">
                            YOU HAVE THE FINAL SAY
                          </span>
                          <h3>Ready to make it real?</h3>
                          <p>
                            {
                              selectedActions.filter(
                                (id) =>
                                  plan.proposedActions.find(
                                    (a) => a.actionId === id,
                                  )?.integration === "google-calendar",
                              ).length
                            }{" "}
                            Calendar events · {cart.length} essentials ·{" "}
                            {money(total)} estimated order
                          </p>
                          {plan.proposedActions.some(
                            (a) => a.integration === "zinc",
                          ) && (
                            <label className="order-checkbox">
                              <input
                                type="checkbox"
                                checked={selectedActions.some(
                                  (id) =>
                                    plan.proposedActions.find(
                                      (a) => a.actionId === id,
                                    )?.integration === "zinc",
                                )}
                                disabled={results.length > 0 || executing}
                                onChange={() => {
                                  const a = plan.proposedActions.find(
                                    (a) => a.integration === "zinc",
                                  );
                                  if (a) toggleAction(a.actionId);
                                }}
                              />{" "}
                              Include Zinc sandbox test order
                            </label>
                          )}
                        </div>
                        {results.length ? (
                          <button
                            className="primary"
                            onClick={() => setScreen("execution")}
                          >
                            View execution results →
                          </button>
                        ) : (
                          <button
                            className="primary"
                            disabled={
                              !selectedActions.length ||
                              executing ||
                              ((total > budget || cart.length === 0) &&
                                selectedActions.some(
                                  (id) =>
                                    plan.proposedActions.find(
                                      (a) => a.actionId === id,
                                    )?.integration === "zinc",
                                ))
                            }
                            onClick={() => execute()}
                          >
                            Approve & execute <span>↗</span>
                          </button>
                        )}
                        {total > budget && (
                          <small className="error-text">
                            Essentials exceed your budget. Remove items or
                            deselect the order.
                          </small>
                        )}
                      </div>
                    )}
                    <Trace entries={plan.trace} />
                  </>
                )}
              </section>
            </motion.main>
          )}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}
