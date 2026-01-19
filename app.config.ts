import { defineConfig } from "@tanstack/react-start/config";
import tsConfigPaths from "vite-tsconfig-paths";
import { isDevelopment } from "./src/lib/env";

export default defineConfig({
  tsr: {
    appDirectory: "src",
  },
  vite: {
    // ssr: {
    //   // Ensure these deps are bundled into serverless output for Vercel
    //   noExternal: ["zod", "@openai/agents"],
    // },
    plugins: [
      tsConfigPaths({
        projects: ["./tsconfig.json"],
      }),
    ],
  },
  server: {
    preset: isDevelopment() ? undefined : "vercel",
  },
});
