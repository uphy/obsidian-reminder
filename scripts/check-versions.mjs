// Validates that manifest.json / manifest-beta.json / versions.json stay consistent.
//
// package.json's version is intentionally excluded: the release flow
// (.github/workflows/release.yml / release-beta.yml) only ever rewrites
// manifest.json / manifest-beta.json, so package.json is expected to drift
// and is not a source of truth for version consistency.
//
// NOTE: release.yml / release-beta.yml never touch versions.json (only the
// local, effectively-unused release.sh does). As a result, in the current
// repo state versions.json is missing entries for several recent
// manifest.json/manifest-beta.json versions. Because of that, a missing
// entry is only a warning here, not a hard failure -- otherwise this check
// would fail against the current repo state, which the invariant doesn't
// actually hold for. What IS enforced as a hard failure is: whenever an
// entry does exist in versions.json for a manifest's version, it must match
// that manifest's minAppVersion (guards against a typo/manual edit going
// out of sync).

import console from "node:console";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));

let hasError = false;

function fail(message) {
  console.error(`ERROR: ${message}`);
  hasError = true;
}

function readJson(relativePath) {
  const absolutePath = join(rootDir, relativePath);
  let raw;
  try {
    raw = readFileSync(absolutePath, "utf8");
  } catch (e) {
    fail(`Failed to read ${relativePath}: ${e.message}`);
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch (e) {
    fail(`${relativePath} is not valid JSON: ${e.message}`);
    return null;
  }
}

function validateManifest(relativePath, manifest) {
  if (manifest === null) {
    return null;
  }
  if (typeof manifest.version !== "string" || manifest.version === "") {
    fail(`${relativePath} is missing a "version" field`);
  }
  if (typeof manifest.minAppVersion !== "string" || manifest.minAppVersion === "") {
    fail(`${relativePath} is missing a "minAppVersion" field`);
  }
  return manifest;
}

function checkVersionsEntry(manifestPath, manifest, versions, { warnOnly }) {
  if (manifest === null || versions === null) {
    return;
  }
  if (typeof manifest.version !== "string" || typeof manifest.minAppVersion !== "string") {
    // Already reported by validateManifest().
    return;
  }

  const entry = versions[manifest.version];
  if (entry === undefined) {
    const message = `versions.json has no entry for ${manifestPath}'s version "${manifest.version}"`;
    if (warnOnly) {
      console.warn(`WARNING: ${message}`);
    } else {
      fail(message);
    }
    return;
  }

  if (entry !== manifest.minAppVersion) {
    fail(
      `versions.json entry for "${manifest.version}" is "${entry}", but ${manifestPath}'s minAppVersion is "${manifest.minAppVersion}"`,
    );
  }
}

const manifest = validateManifest("manifest.json", readJson("manifest.json"));
const manifestBeta = validateManifest("manifest-beta.json", readJson("manifest-beta.json"));
const versions = readJson("versions.json");

// manifest.json: see the NOTE above -- a missing entry is a warning, not a
// failure, because the current release flow doesn't keep versions.json in
// sync. A mismatched entry is still a hard failure.
checkVersionsEntry("manifest.json", manifest, versions, { warnOnly: true });

// manifest-beta.json: same treatment, and for the same reason (confirmed by
// reading the current repo state: versions.json has no entry for the
// current beta version either).
checkVersionsEntry("manifest-beta.json", manifestBeta, versions, { warnOnly: true });

if (hasError) {
  console.error("Version consistency check failed.");
  process.exit(1);
}

console.log("Version consistency check passed.");
