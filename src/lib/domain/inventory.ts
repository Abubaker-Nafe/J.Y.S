export type InventoryState = {
  deducted: boolean;
  restored: boolean;
};

export type InventoryAction = "NONE" | "DEDUCT" | "RESTORE";

export function inventoryActionForTransition(
  state: InventoryState,
  nextStatus: "CONFIRMED" | "CANCELLED" | string,
): InventoryAction {
  if (nextStatus === "CONFIRMED" && !state.deducted) return "DEDUCT";
  if (nextStatus === "CANCELLED" && state.deducted && !state.restored) return "RESTORE";
  return "NONE";
}

export function applyInventoryDelta(stock: number, quantityDelta: number): number {
  if (!Number.isInteger(stock) || stock < 0 || !Number.isInteger(quantityDelta)) {
    throw new Error("Inventory values must be integers");
  }
  const next = stock + quantityDelta;
  if (next < 0) throw new Error("Insufficient stock");
  if (!Number.isSafeInteger(next)) throw new Error("Inventory exceeds safe range");
  return next;
}

