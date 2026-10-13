import { describe, expect, it } from 'vitest';
import { supersededChecks } from './superseded-checks.js';

const NO = 'no';
const YES = 'yes';
const read = (key: string, verdict: string, passive = true) => ({
  key,
  passive,
  held: YES === verdict,
  failed: NO === verdict,
});

describe('which checks read too early', () => {
  it('supersedes a passive no that the same claim later proves', () => {
    expect([...supersededChecks([read('A', NO), read('A', YES)])]).toEqual([0]);
  });

  // The review's hole: every earlier test repeated one claim, so a rule that let ANY later pass
  // excuse ANY earlier failure stayed green.
  it('never lets a different claim holding excuse a failure', () => {
    expect(supersededChecks([read('A', NO), read('B', YES)]).size).toBe(0);
  });

  it('never excuses a declared check, or a failure after the claim had held', () => {
    expect(supersededChecks([read('A', NO, false), read('A', YES)]).size).toBe(0);
    expect(supersededChecks([read('A', YES), read('A', NO)]).size).toBe(0);
  });
});
