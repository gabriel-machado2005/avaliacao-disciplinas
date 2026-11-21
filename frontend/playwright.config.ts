import { defineConfig } from "@playwright/test";
import path from "node:path";
import os from "node:os";

const root = import.meta.dirname;
const evidence =
  process.env.UI_ARTIFACTS_DIR ??
  path.join(os.tmpdir(), `unixs-ui-${Date.now()}`);
const repository = path.resolve(root, "..").toLowerCase();
if (
  path.resolve(evidence).toLowerCase() === repository ||
  path
    .resolve(evidence)
    .toLowerCase()
    .startsWith(repository + path.sep)
) {
  throw new Error("As evidências devem ficar fora do repositório.");
}
process.env.UI_ARTIFACTS_DIR = evidence;
const certificates = path.resolve(
  root,
  "../../certificados-avaliacao-disciplinas",
);

export default defineConfig({
  testDir: "./e2e",
  outputDir: path.join(evidence, "captures"),
  timeout: 120_000,
  expect: { timeout: 15_000 },
  workers: 2,
  retries: 0,
  reporter: [
    ["list"],
    ["json", { outputFile: path.join(evidence, "results.json") }],
    ["html", { outputFolder: path.join(evidence, "report"), open: "never" }],
  ],
  use: {
    baseURL: "https://localhost:5174",
    browserName: "chromium",
    ignoreHTTPSErrors: false,
    serviceWorkers: "block",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    locale: "pt-BR",
  },
  projects: [360, 390, 768, 1024, 1366, 1920].map((width) => ({
    name: `${width}px`,
    use: { viewport: { width, height: width <= 390 ? 844 : 900 } },
  })),
  webServer: {
    command: "npm run dev -- --port 5174 --mode ui",
    url: "https://localhost:5174",
    ignoreHTTPSErrors: false,
    reuseExistingServer: false,
    env: {
      HTTPS_ENABLED: "true",
      HTTPS_CERT_PATH:
        process.env.UI_HTTPS_CERT_PATH ??
        path.join(certificates, "localhost.pem"),
      HTTPS_KEY_PATH:
        process.env.UI_HTTPS_KEY_PATH ??
        path.join(certificates, "localhost-key.pem"),
      VITE_API_BASE_URL: "https://api.unixs-ui.invalid",
    },
  },
});
