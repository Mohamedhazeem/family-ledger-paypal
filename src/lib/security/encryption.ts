import "server-only";

/**
 * Server-only facade over the AES-256-GCM field cipher (ADR-0008).
 * Application code imports from here; scripts that run outside Next
 * (seed, migrations) import `./cipher` directly.
 */
export { decryptField, encryptField } from "./cipher";
