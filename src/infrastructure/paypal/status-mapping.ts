import "server-only";

/**
 * PayPal status mapping (Slice 4.3): re-exports the domain table so
 * adapter code has one place to find the PayPal-specific constants.
 */
export {
  mapBatchStatus,
  knownBatchStatus,
  friendlyBatchStatus,
} from "@/domain/payout-status";
