import type { FulfillmentOrderSnapshot, FulfillmentSummaryStatus } from "./order";

/**
 * Computes the projection `fulfillmentSummary` for CustomerOrder based on the
 * statuses of its constituent FulfillmentOrders (see docs/03-state-machines.md §3.1).
 */
export function computeFulfillmentSummary(
  fulfillmentOrders: readonly FulfillmentOrderSnapshot[],
): FulfillmentSummaryStatus {
  if (fulfillmentOrders.length === 0) {
    return "UNFULFILLED";
  }

  const isTerminalCanceled = (s: string) => s === "REJECTED" || s === "CANCELED";
  const isDelivered = (s: string) => s === "DELIVERED";
  const isReturnInProgress = (s: string) => s === "RETURN_REQUESTED" || s === "RETURNING";
  const isInProgress = (s: string) =>
    s === "PENDING_ACCEPTANCE" ||
    s === "ACCEPTED" ||
    s === "PACKING" ||
    s === "READY_TO_SHIP" ||
    s === "SHIPPED" ||
    s === "IN_TRANSIT" ||
    s === "DELIVERY_FAILED";

  const total = fulfillmentOrders.length;
  const canceledCount = fulfillmentOrders.filter((f) => isTerminalCanceled(f.status)).length;
  const deliveredCount = fulfillmentOrders.filter((f) => isDelivered(f.status)).length;
  const inProgressCount = fulfillmentOrders.filter((f) => isInProgress(f.status)).length;
  const returnInProgressCount = fulfillmentOrders.filter((f) => isReturnInProgress(f.status)).length;
  const refundedCount = fulfillmentOrders.filter((f) => f.status === "REFUNDED").length;

  // 1. Return request in progress
  if (returnInProgressCount > 0) {
    return "RETURN_IN_PROGRESS";
  }

  // 2. All canceled or rejected
  if (canceledCount === total) {
    return "CANCELED";
  }

  // 3. Delivered + (Canceled or Refunded)
  if (deliveredCount > 0 && (canceledCount > 0 || refundedCount > 0)) {
    return "PARTIALLY_COMPLETED";
  }

  // 4. At least one delivered, others still in progress
  if (deliveredCount > 0 && inProgressCount > 0) {
    return "PARTIALLY_FULFILLED";
  }

  // 5. All delivered
  if (deliveredCount === total) {
    return "FULFILLED";
  }

  // 6. Some canceled/rejected, others still in progress
  if (canceledCount > 0 && inProgressCount > 0) {
    return "PARTIALLY_CANCELED";
  }

  // 7. Initial / all in progress
  return "UNFULFILLED";
}
