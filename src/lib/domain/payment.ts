export type DomainPaymentStatus = "PENDING" | "PAID" | "CANCELLED";

export const PAYMENT_STATUS_LOCKED_MESSAGE = "Payment status cannot be changed after an order is delivered or cancelled.";

export function isPaymentStatusLocked(orderStatus: string): boolean {
  return orderStatus === "DELIVERED" || orderStatus === "CANCELLED";
}

export function assertPaymentStatusEditable(orderStatus: string): void {
  if (isPaymentStatusLocked(orderStatus)) throw new Error(PAYMENT_STATUS_LOCKED_MESSAGE);
}

const allowedPaymentTransitions: Record<DomainPaymentStatus, readonly DomainPaymentStatus[]> = {
  PENDING: ["PAID", "CANCELLED"],
  PAID: ["PENDING"],
  CANCELLED: ["PENDING"],
};

export function assertPaymentStatusTransition(from: DomainPaymentStatus, to: DomainPaymentStatus) {
  if (from === to) return;
  if (!allowedPaymentTransitions[from].includes(to)) {
    throw new Error(`Payment status cannot move from ${from} to ${to}`);
  }
}
