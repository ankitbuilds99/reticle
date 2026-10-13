#!/usr/bin/env node
// The unpacked size of the two published packages a size change is felt in, against a budget.
//
// ONE implementation, run by the `package-quality` job in `.github/workflows/ci.yml` and by hand
// (`pnpm build && pnpm check:pack-size`). It used to live only in that workflow, which no local
// gate runs, so #1493 learned it had blown the server budget from CI after every local gate was
// green. Needs a built tree: `npm pack` runs each package's prepack.
//
// THE CONVENTION: each budget is set once a year to cover a year of work, and is never raised per
// change. A change that goes over cuts size: find what grew and take it out. Re-raising the number
// on every red run is what turned this check into churn instead of a signal. The history of past
// ceilings is in the version history of this file.
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/*
 * The browser SDK is embedded in users' apps. This is the package's shipped code (source maps
 * included), NOT the bundled+deps figure. Most of it is dist/reticle-inject.js, the zero-install
 * reader the daemon evaluates in a page whose app never ran `init`; a slimmer reader without the
 * HUD is the known way to bring it down.
 *
 * Set 2026-10-12 as a budget for about a year of work. Measured 1,488,024 B at 81e046201. Review
 * it once a year, not per change; a sudden jump inside it is still worth a look in review.
 */
const BROWSER_MAX_BYTES = 2_200_000;

/*
 * Nobody installs @reticlehq/server as a dependency; an agent runs it with `npx`, which downloads
 * it before the first tool call of a fresh machine, so its size is on the path to the first
 * verdict. About 1MB of it is the docs `pack-docs.mjs` stages so the MCP surface can answer
 * offline: the first place to look when it grows.
 *
 * Set 2026-10-12 as a budget for about a year of work. Measured 7,096,212 B at 81e046201. Review
 * it once a year, not per change; a sudden jump inside it is still worth a look in review.
 */
const SERVER_MAX_BYTES = 11_000_000;

const BUDGETS = [
  { name: '@reticlehq/browser', dir: 'adapters/realm/browser', max: BROWSER_MAX_BYTES },
  { name: '@reticlehq/server', dir: 'server', max: SERVER_MAX_BYTES },
];

/** `npm pack --dry-run --json`'s unpackedSize. prepack may print first, so parse from the array. */
function unpackedSize(dir) {
  const res = spawnSync('npm', ['pack', '--dry-run', '--json'], {
    cwd: join(ROOT, dir),
    encoding: 'utf8',
    shell: process.platform === 'win32',
    maxBuffer: 64 * 1024 * 1024,
  });
  if (res.status !== 0) throw new Error(`npm pack failed in ${dir}:\n${res.stderr}`);
  const start = res.stdout.search(/^\[/m);
  if (start < 0) throw new Error(`npm pack in ${dir} printed no JSON:\n${res.stdout}`);
  return JSON.parse(res.stdout.slice(start))[0].unpackedSize;
}

let failed = false;
for (const { name, dir, max } of BUDGETS) {
  const bytes = unpackedSize(dir);
  const room = max - bytes;
  console.log(`${name} unpacked: ${bytes} bytes (ceiling ${max}, ${room} to spare)`);
  if (bytes > max) {
    failed = true;
    console.log(
      `::error::${name} unpacked size ${bytes} exceeds the ${max} budget. Cut size: find what ` +
        `grew and take it out. The budget is revisited once a year, not raised per change.`,
    );
  }
}
process.exit(failed ? 1 : 0);
