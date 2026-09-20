import { defineConfig } from "vitest/config";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsConfigPaths({ projects: ["./tsconfig.json"] })],
  test: {
    // Vercel Preview sets AUTH0_DISABLED=true (ephemeral preview URLs cannot be
    // OAuth callbacks) and the build script runs the suite there. Unit tests
    // exercise the enabled code paths, so pin the flag off regardless of the
    // ambient environment.
    env: { AUTH0_DISABLED: "false" },
  },
});
