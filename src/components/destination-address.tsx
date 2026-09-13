"use client";
import { useEffect, useRef, useState } from "react";
import {
  AddressFieldsSchema,
  emptyAddress,
  type AddressFields,
} from "@/agent/address";
import { PlaceInput, type PlaceChoice } from "./place-input";

export function DestinationAddress({
  value,
  onChange,
  onPlace,
}: {
  value: AddressFields;
  onChange: (value: AddressFields) => void;
  onPlace: (place: PlaceChoice | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  async function select(place: PlaceChoice) {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setQuery(place.text);
    onPlace(null);
    onChange({ ...emptyAddress });
    setLoading(true);
    setError("");
    try {
      const response = await fetch(
        `/api/places?id=${encodeURIComponent(place.placeId)}`,
        { signal: controller.signal },
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          "Could not load this address. Enter the complete address below.",
        );
      const fields = AddressFieldsSchema.parse(
        data.addressFields ?? emptyAddress,
      );
      onChange(fields);
      onPlace(place);
    } catch (e) {
      if (!controller.signal.aborted)
        setError(
          e instanceof Error
            ? e.message
            : "Address unavailable. Enter it below.",
        );
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }
  function edit(field: keyof AddressFields, next: string) {
    if (field !== "unit") onPlace(null);
    onChange({ ...value, [field]: next });
  }
  const fields: {
    key: keyof AddressFields;
    label: string;
    placeholder: string;
    autoComplete?: string;
    optional?: boolean;
  }[] = [
    {
      key: "street",
      label: "Street",
      placeholder: "Van Ness Avenue",
      autoComplete: "address-line1",
    },
    { key: "number", label: "Street number", placeholder: "2550" },
    {
      key: "unit",
      label: "Apartment / suite",
      placeholder: "Apartment 4B",
      autoComplete: "address-line2",
      optional: true,
    },
    {
      key: "city",
      label: "City",
      placeholder: "San Francisco",
      autoComplete: "address-level2",
    },
    {
      key: "state",
      label: "State / province",
      placeholder: "California",
      autoComplete: "address-level1",
      optional: true,
    },
    {
      key: "country",
      label: "Country",
      placeholder: "United States",
      autoComplete: "country-name",
    },
    {
      key: "postalCode",
      label: "Postal code / ZIP / CEP",
      placeholder: "94109",
      autoComplete: "postal-code",
    },
  ];
  return (
    <div className="destination-address">
      <PlaceInput
        label="Where will you be staying?"
        placeholder="Search an address to autofill, or enter it below"
        value={query}
        onChange={(next) => {
          request.current?.abort();
          setLoading(false);
          setQuery(next);
        }}
        onSelect={(place) => void select(place)}
      />
      <p className="field-help" role="status">
        {loading
          ? "Loading the complete address…"
          : "Confirm every field below. Add any details Google didn’t provide."}
      </p>
      {error && (
        <p role="alert" className="notice">
          {error}
        </p>
      )}
      <div className="address-fields">
        {fields.map((field) => (
          <div className={`field address-${field.key}`} key={field.key}>
            <label htmlFor={`address-${field.key}`}>
              {field.label}
              {field.optional && <small> · optional</small>}
            </label>
            <input
              id={`address-${field.key}`}
              value={value[field.key]}
              onChange={(e) => edit(field.key, e.target.value)}
              required={!field.optional}
              disabled={loading}
              autoComplete={field.autoComplete}
              placeholder={field.placeholder}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
