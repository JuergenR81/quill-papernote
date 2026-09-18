#!/usr/bin/env node

// Builds packages/quill, packs it, and attaches the tarball to a GitHub release.
//
// The version is not an argument: it is whatever packages/quill/package.json says,
// which is the file you edited in the commit you tagged. Bumping, committing, tagging
// and pushing happen on your machine, so CI never writes back into the repository.
//
//   cd packages/quill && npm version 2.3.0
//   git push origin main --follow-tags

const exec = require("node:child_process").execSync;
const fs = require("node:fs");
const path = require("node:path");
const { parseArgs } = require("node:util");

const args = parseArgs({
  options: {
    "dry-run": { type: "boolean", default: false },
    npm: { type: "boolean", default: false },
  },
});

const dryRun = args.values["dry-run"];
const toNpm = args.values.npm;

/** The only package this script releases. */
const packageFolder = "packages/quill";

const exitWithError = (message) => {
  console.error(`Exit with error: ${message}`);
  process.exit(1);
};

const run = (command, options) => {
  if (dryRun) {
    console.log(`  would run: ${command}`);
    return;
  }
  exec(command, { stdio: "inherit", ...options });
};

if (dryRun) {
  console.log('Running in "dry-run" mode: nothing is published or uploaded.\n');
} else if (!process.env.CI) {
  exitWithError("Refusing to publish outside CI. Pass --dry-run to try it here.");
}

const version = JSON.parse(
  fs.readFileSync(path.join(packageFolder, "package.json"), "utf-8"),
).version;

// A prerelease such as 2.3.0-rc.1 becomes the "rc" dist-tag and is marked as a
// prerelease on GitHub; a plain version becomes "latest".
const match = version.match(
  /^(?:[0-9]+\.){2}(?:[0-9]+)(?:-(dev|alpha|beta|rc)\.[0-9]+)?$/,
);
if (!match) {
  exitWithError(`Invalid version in ${packageFolder}/package.json: ${version}`);
}
const distTag = match[1] || "latest";

// When a tag triggered the run, it has to agree with the package. Without this a
// v2.3.0 tag on a commit that still says 2.2.6 would publish 2.2.6 under that tag.
if (process.env.GITHUB_REF_TYPE === "tag") {
  const tagged = process.env.GITHUB_REF_NAME.replace(/^v/, "");
  if (tagged !== version) {
    exitWithError(
      `Tag v${tagged} does not match ${packageFolder}/package.json (${version})`,
    );
  }
}

console.log(`Releasing ${version} (dist-tag: ${distTag})\n`);

console.log("Building");
exec("pnpm run build:quill", { stdio: "inherit" });

const bundle = path.join(packageFolder, "dist", "quill.js");
if (!fs.existsSync(bundle)) {
  exitWithError(`Build did not produce ${bundle}`);
}

// The published package carries the repository README.
fs.writeFileSync(
  path.join(packageFolder, "README.md"),
  fs.readFileSync("README.md", "utf-8"),
);

console.log("\nPacking");
exec("pnpm pack", { stdio: "inherit", cwd: packageFolder });
const tarball = path.join(packageFolder, `quill-next-${version}.tgz`);
if (!fs.existsSync(tarball)) {
  exitWithError(`pnpm pack did not produce ${tarball}`);
}
console.log(`  ${tarball}`);

console.log("\nAttaching to the GitHub release");
const prerelease = distTag === "latest" ? "--latest" : "--prerelease";
run(
  `gh release create v${version} ${tarball} ${prerelease} ` +
    `-t "Version ${version}" --generate-notes`,
);

if (toNpm) {
  console.log("\nPublishing to npm");
  // pnpm rewrites the workspace: protocol into real version ranges on publish; npm
  // does not, and would ship unusable dependency specs for the wrapper packages.
  if (!dryRun) {
    exec('echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" > ~/.npmrc');
  }
  run(`pnpm publish --tag ${distTag} --no-git-checks`, { cwd: packageFolder });
} else {
  console.log("\nSkipping npm; pass --npm to publish there as well.");
}
