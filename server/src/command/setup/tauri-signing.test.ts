/**
 * The Tauri dev build Reticle starts is signed with the project's identity, so macOS stops asking
 * for the keychain password. `tauri dev` ignores APPLE_SIGNING_IDENTITY (only `tauri build` reads
 * it), so the signing happens in a Cargo runner — exercised here as the real shell script.
 */
import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RUNNER_SCRIPT, SigningEnv, tauriSigningEnv, type SigningDeps } from './tauri-signing.js';

const CONF = JSON.stringify({
  identifier: 'com.acme.notes',
  bundle: { macOS: { signingIdentity: 'Developer ID Application: Acme (TEAM123)' } },
});

const deps = (over: Partial<SigningDeps> = {}): SigningDeps => ({
  platform: 'darwin',
  env: {},
  read: () => CONF,
  writeRunner: (name) => `/state/${name}`,
  ...over,
});

describe('signing the Tauri dev build', () => {
  it('runs the build through a signing runner with the identity and bundle identifier', () => {
    const env = tauriSigningEnv(deps());
    expect(env[SigningEnv.IDENTITY]).toBe('Developer ID Application: Acme (TEAM123)');
    expect(env[SigningEnv.IDENTIFIER]).toBe('com.acme.notes');
    expect(env['CARGO_TARGET_AARCH64_APPLE_DARWIN_RUNNER']).toBe('/state/tauri-sign-runner.sh');
  });

  it('prefers APPLE_SIGNING_IDENTITY, as tauri build does', () => {
    const env = tauriSigningEnv(deps({ env: { [SigningEnv.APPLE]: 'Apple Development: Me' } }));
    expect(env[SigningEnv.IDENTITY]).toBe('Apple Development: Me');
  });

  it('does nothing off macOS, without an identity, with ad-hoc, or over a runner of its own', () => {
    expect(tauriSigningEnv(deps({ platform: 'linux' }))).toEqual({});
    expect(tauriSigningEnv(deps({ read: () => JSON.stringify({ identifier: 'x' }) }))).toEqual({});
    expect(tauriSigningEnv(deps({ env: { [SigningEnv.APPLE]: '-' } }))).toEqual({});
    expect(
      tauriSigningEnv(deps({ env: { CARGO_TARGET_AARCH64_APPLE_DARWIN_RUNNER: 'mine' } })),
    ).toEqual({});
    expect(tauriSigningEnv(deps({ writeRunner: () => '/a dir/r.sh' }))).toEqual({});
  });
});

describe.skipIf('win32' === process.platform)('the runner script', () => {
  it('signs the binary Cargo built, then runs it with its arguments', () => {
    const dir = mkdtempSync(join(tmpdir(), 'reticle-sign-'));
    const calls = join(dir, 'calls');
    // A fake codesign on PATH records how it was called.
    writeFileSync(join(dir, 'codesign'), `#!/bin/sh\necho "$@" >> "${calls}"\n`);
    chmodSync(join(dir, 'codesign'), 0o755);
    const app = join(dir, 'app');
    writeFileSync(app, '#!/bin/sh\necho "ran $*"\n');
    chmodSync(app, 0o755);
    const runner = join(dir, 'runner.sh');
    writeFileSync(runner, RUNNER_SCRIPT);
    chmodSync(runner, 0o755);
    const out = execFileSync(runner, [app, '--flag'], {
      encoding: 'utf8',
      env: {
        PATH: `${dir}:/usr/bin:/bin`,
        [SigningEnv.IDENTITY]: 'Dev ID',
        [SigningEnv.IDENTIFIER]: 'com.acme.notes',
      },
    });
    expect(out.trim()).toBe('ran --flag');
    expect(readFileSync(calls, 'utf8').trim()).toBe(
      `--force --sign Dev ID --identifier com.acme.notes ${app}`,
    );
  });

  it('still runs the app when signing fails', () => {
    const dir = mkdtempSync(join(tmpdir(), 'reticle-sign-'));
    writeFileSync(join(dir, 'codesign'), '#!/bin/sh\nexit 1\n');
    chmodSync(join(dir, 'codesign'), 0o755);
    const app = join(dir, 'app');
    writeFileSync(app, '#!/bin/sh\necho ran\n');
    chmodSync(app, 0o755);
    const runner = join(dir, 'runner.sh');
    writeFileSync(runner, RUNNER_SCRIPT);
    chmodSync(runner, 0o755);
    const out = execFileSync(runner, [app], {
      encoding: 'utf8',
      env: {
        PATH: `${dir}:/usr/bin:/bin`,
        [SigningEnv.IDENTITY]: 'x',
        [SigningEnv.IDENTIFIER]: 'y',
      },
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    expect(out.trim()).toBe('ran');
  });
});
