import { access, readFile, stat } from "node:fs/promises";

const pkg = JSON.parse(await readFile("package.json", "utf8"));
const marketplaceManifest = JSON.parse(
  await readFile("marketplace/manifest.json", "utf8")
);
const readme = await readFile("README.md", "utf8");
const changelog = await readFile("CHANGELOG.md", "utf8");
const mainEntry = await readFile(pkg.main, "utf8");
const bundlePath = "dist/index.js";
const bundle = await readFile(bundlePath, "utf8");

const failures = [];

function requireValue(label, value) {
  if (!value || (typeof value === "string" && !value.trim())) {
    failures.push(`${label} is missing`);
  }
}

requireValue("package name", pkg.name);
requireValue("package version", pkg.version);
requireValue("package description", pkg.description);
requireValue("package author", pkg.author);
requireValue("package repository", pkg.repository?.url);
requireValue("Logseq plugin id", pkg.logseq?.id);
requireValue("Logseq plugin title", pkg.logseq?.title);
requireValue("Logseq plugin icon", pkg.logseq?.icon);

if (marketplaceManifest.effect !== true) {
  failures.push(
    "marketplace manifest must enable the same-origin sandbox for editor key handling"
  );
}

for (const file of [
  pkg.main,
  bundlePath,
  pkg.logseq?.icon,
  "LICENSE",
  "README.md",
  "CHANGELOG.md",
  "docs/preview1.png",
  "marketplace/manifest.json"
]) {
  try {
    await access(file);
  } catch {
    failures.push(`required file is missing: ${file}`);
  }
}

if (!readme.includes("docs/preview1.png")) {
  failures.push("README does not include the plugin preview");
}

if (!readme.includes("/Plus Minus Next")) {
  failures.push("README does not document the slash command");
}

if (!changelog.includes(`## [${pkg.version}]`)) {
  failures.push(`CHANGELOG has no ${pkg.version} release entry`);
}

if (!mainEntry.includes("./index.js")) {
  failures.push(`${pkg.main} does not load the plugin bundle`);
}

if (!bundle.includes("pmn-board") || !bundle.includes("registerSlashCommand")) {
  failures.push("built bundle does not contain the expected plugin entry points");
}

const bundleStats = await stat(bundlePath);
if (bundleStats.size === 0) {
  failures.push("built bundle is empty");
}

if (failures.length > 0) {
  console.error("Release validation failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(
    `Release validation passed for ${pkg.name} v${pkg.version} (${bundleStats.size} bytes).`
  );
}
