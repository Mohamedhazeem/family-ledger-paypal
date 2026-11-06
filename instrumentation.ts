import { env } from "./src/env";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Access env to fail fast at boot if required vars are missing.
    void env;
  }
}
