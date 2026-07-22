import { moneyToMinor } from "./money";

export function calculateDeliveryFee(input: {
  fulfillmentMethod: "DELIVERY" | "PICKUP";
  cityFee: string | number | { toString(): string };
  areaFee?: string | number | { toString(): string } | null;
}): number {
  if (input.fulfillmentMethod === "PICKUP") return 0;
  return moneyToMinor(input.areaFee ?? input.cityFee);
}

