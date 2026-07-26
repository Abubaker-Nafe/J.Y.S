export type DomainPaymentStatus = "PENDING" | "PAID" | "CANCELLED";

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
