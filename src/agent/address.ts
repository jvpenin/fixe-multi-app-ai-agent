import { z } from "zod";
export const AddressFieldsSchema = z.object({
  street: z.string().trim(),
  number: z.string().trim(),
  unit: z.string().trim(),
  city: z.string().trim(),
  state: z.string().trim(),
  country: z.string().trim(),
  postalCode: z.string().trim(),
});
export type AddressFields = z.infer<typeof AddressFieldsSchema>;
export const CompleteAddressSchema = AddressFieldsSchema.extend({
  street: z.string().trim().min(1),
  number: z.string().trim().min(1),
  city: z.string().trim().min(1),
  country: z.string().trim().min(1),
  postalCode: z.string().trim().min(1),
});
export const emptyAddress: AddressFields = {
  street: "",
  number: "",
  unit: "",
  city: "",
  state: "",
  country: "",
  postalCode: "",
};
export function formatAddress(value: AddressFields) {
  return [
    `${value.number} ${value.street}`.trim(),
    value.unit,
    value.city,
    value.state,
    value.postalCode,
    value.country,
  ]
    .filter(Boolean)
    .join(", ");
}
export type AddressComponent = {
  longText?: string;
  shortText?: string;
  types?: string[];
};
export function addressFromGoogle(
  components: AddressComponent[],
): AddressFields {
  const part = (type: string) =>
    components.find((c) => c.types?.includes(type))?.longText ?? "";
  return {
    street: part("route"),
    number: part("street_number"),
    unit: part("subpremise"),
    city:
      part("locality") ||
      part("postal_town") ||
      part("administrative_area_level_2") ||
      part("sublocality_level_1"),
    state: part("administrative_area_level_1"),
    country: part("country"),
    postalCode: [part("postal_code"), part("postal_code_suffix")]
      .filter(Boolean)
      .join("-"),
  };
}
