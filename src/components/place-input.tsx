"use client";
import { useEffect, useId, useState } from "react";
export type PlaceChoice = { placeId: string; text: string };
export function PlaceInput({
  label,
  value,
  onChange,
  onSelect,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onSelect: (place: PlaceChoice) => void;
  placeholder?: string;
}) {
  const id = useId();
  const [choices, setChoices] = useState<PlaceChoice[]>([]);
  const [focused, setFocused] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!focused || value.trim().length < 3) {
      setChoices([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`/api/places?q=${encodeURIComponent(value)}`, {
          signal: controller.signal,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setChoices(data);
      } catch (e) {
        if (!controller.signal.aborted)
          setError(e instanceof Error ? e.message : "Search unavailable");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [value, focused]);
  return (
    <div className="field autocomplete">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={(e) => {
          if (!e.currentTarget.parentElement?.contains(e.relatedTarget))
            setFocused(false);
        }}
        autoComplete="off"
        aria-expanded={focused && choices.length > 0}
        aria-controls={`${id}-results`}
        role="combobox"
      />
      {focused && (
        <div className="search-results" id={`${id}-results`}>
          <div role="status">
            {loading && <small>Searching Google Places…</small>}
            {error && <small className="error-text">{error}</small>}
          </div>
          {choices.map((p) => (
            <button
              type="button"
              key={p.placeId}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onSelect(p);
                setFocused(false);
                setChoices([]);
              }}
            >
              ⌖ <span>{p.text}</span>
            </button>
          ))}
          {choices.length > 0 && <small>Powered by Google</small>}
        </div>
      )}
    </div>
  );
}
