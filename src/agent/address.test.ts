import { describe, expect, it } from "vitest";
import {
  addressFromGoogle,
  CompleteAddressSchema,
  emptyAddress,
  formatAddress,
} from "./address";
import { PlanRequestSchema } from "./schemas";
import { demoPlanRequest } from "./orchestrator";

describe("complete destination address", () => {
  const address = {
    street: "Van Ness Avenue",
    number: "2550",
    unit: "Apartment 4B",
    city: "San Francisco",
    state: "California",
    country: "United States",
    postalCode: "94109",
  };
  it("requires street, number, city, country and postal code", () => {
    expect(CompleteAddressSchema.safeParse(address).success).toBe(true);
    for (const key of ["street", "number", "city", "country", "postalCode"]) {
      expect(
        CompleteAddressSchema.safeParse({ ...address, [key]: "  " }).success,
      ).toBe(false);
    }
    expect(
      CompleteAddressSchema.safeParse({ ...address, state: "", unit: "" })
        .success,
    ).toBe(true);
  });
  it("keeps all address details in the planning input", () => {
    expect(formatAddress(address)).toBe(
      "2550 Van Ness Avenue, Apartment 4B, San Francisco, California, 94109, United States",
    );
    expect(
      PlanRequestSchema.parse({
        ...demoPlanRequest,
        destinationAddress: address,
      }).destinationAddress,
    ).toEqual(address);
    expect(
      PlanRequestSchema.safeParse({
        ...demoPlanRequest,
        destinationAddress: { ...address, postalCode: "" },
      }).success,
    ).toBe(false);
  });
  it("maps Google components without inventing missing values", () => {
    expect(addressFromGoogle([])).toEqual(emptyAddress);
    const fields = addressFromGoogle([
      { types: ["street_number"], longText: "2550" },
      { types: ["route"], longText: "Van Ness Avenue" },
      { types: ["locality"], longText: "San Francisco" },
      { types: ["administrative_area_level_1"], longText: "California" },
      { types: ["country"], longText: "United States" },
      { types: ["postal_code"], longText: "94109" },
      { types: ["postal_code_suffix"], longText: "1234" },
    ]);
    expect(fields).toEqual({ ...address, unit: "", postalCode: "94109-1234" });
    expect(
      addressFromGoogle([{ types: ["postal_town"], longText: "London" }]).city,
    ).toBe("London");
  });
});
