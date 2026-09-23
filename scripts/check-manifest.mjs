import fs from "node:fs";
import path from "node:path";

const root = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  "..",
);
const manifestPath = path.join(root, "extension", "manifest.firefox.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

const required = [
  ...(manifest.background?.service_worker
    ? [manifest.background.service_worker]
    : (manifest.background?.scripts ?? [])),
  manifest.action?.default_popup,
  manifest.options_ui?.page,
  ...Object.values(manifest.icons ?? {}),
];

if (manifest.manifest_version !== 3) {
  throw new Error("Firefox manifest must use Manifest V3");
}
if (manifest.browser_specific_settings?.gecko?.strict_min_version !== "140.0") {
  throw new Error("Firefox manifest must require Firefox 140.0");
}
if (
  (!manifest.background?.service_worker && !manifest.background?.scripts) ||
  manifest.key
) {
  throw new Error(
    "Firefox manifest is missing a valid background entry or contains a signing key",
  );
}

for (const relativePath of required) {
  if (
    !relativePath ||
    !fs.existsSync(path.join(root, "extension", relativePath))
  ) {
    throw new Error(`Manifest path does not exist: ${relativePath}`);
  }
}

console.log("Firefox manifest is valid");
