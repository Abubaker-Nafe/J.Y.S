export type DomainFulfillmentMethod = "DELIVERY" | "PICKUP";
export type DomainOrderStatus =
  | "NEW"
  | "CONFIRMED"
  | "PREPARING"
  | "READY_FOR_DELIVERY"
  | "SENT_TO_DELIVERY_COMPANY"
  | "DELIVERED"
  | "READY_FOR_PICKUP"
  | "COLLECTED"
  | "CANCELLED";

const DELIVERY_TRANSITIONS: Record<DomainOrderStatus, readonly DomainOrderStatus[]> = {
  NEW: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY_FOR_DELIVERY", "CANCELLED"],
  READY_FOR_DELIVERY: ["SENT_TO_DELIVERY_COMPANY", "CANCELLED"],
  SENT_TO_DELIVERY_COMPANY: ["DELIVERED", "CANCELLED"],
  DELIVERED: [],
  READY_FOR_PICKUP: [],
  COLLECTED: [],
  CANCELLED: [],
};

const PICKUP_TRANSITIONS: Record<DomainOrderStatus, readonly DomainOrderStatus[]> = {
  NEW: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY_FOR_PICKUP", "CANCELLED"],
  READY_FOR_PICKUP: ["COLLECTED", "CANCELLED"],
  COLLECTED: [],
  READY_FOR_DELIVERY: [],
  SENT_TO_DELIVERY_COMPANY: [],
  DELIVERED: [],
  CANCELLED: [],
};

export function allowedOrderTransitions(
  method: DomainFulfillmentMethod,
  status: DomainOrderStatus,
): readonly DomainOrderStatus[] {
  return (method === "DELIVERY" ? DELIVERY_TRANSITIONS : PICKUP_TRANSITIONS)[status];
}

export function canTransitionOrder(
  method: DomainFulfillmentMethod,
  from: DomainOrderStatus,
  to: DomainOrderStatus,
): boolean {
  return from === to || allowedOrderTransitions(method, from).includes(to);
}

export function assertOrderTransition(
  method: DomainFulfillmentMethod,
  from: DomainOrderStatus,
  to: DomainOrderStatus,
): void {
  if (!canTransitionOrder(method, from, to)) {
    throw new Error(`Order cannot transition from ${from} to ${to} for ${method}`);
  }
}

export function isCompletedStatus(status: DomainOrderStatus): boolean {
  return status === "DELIVERED" || status === "COLLECTED";
}

