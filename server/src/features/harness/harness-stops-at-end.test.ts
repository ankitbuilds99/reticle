/**
 * A drive stops once a check has held and the page shows the end its goal quotes.
 *
 * Driven over MCP: the model reached "Generated script for", kept going, navigated to a start page
 * that signs the app out, and ended on a page without the result — a working journey failed by the
 * drive's own wandering.
 */
import { describe, expect, it } from 'vitest';
import { ReticleTool, Verified } from '@reticlehq/core';
import { runHarness, StopReason, type HarnessToolset, type ModelDriver } from './harness.js';

const END = 'Generated script for';

/** A model that never finishes: it presses Generate with a check, every turn, forever. */
const relentless: ModelDriver = {
  turn: () =>
    Promise.resolve({
      text: '',
      calls: [
        {
          id: 'c',
          name: ReticleTool.ACT_AND_WAIT,
          args: { ref: 'e1', action: 'click', until: { kind: 'net', method: 'POST' } },
        },
      ],
    }),
};

function page(showsEnd: () => boolean, verdict: string): HarnessToolset {
  return {
    tools: [],
    invoke: (name) => {
      if (ReticleTool.SNAPSHOT === name)
        return Promise.resolve({
          tree: showsEnd() ? `- text "${END}: notes"` : '- button "Generate"',
        });
      if (ReticleTool.SCROLL_TO === name) return Promise.resolve({ found: showsEnd() });
      return Promise.resolve({ verified: verdict });
    },
  };
}

const endsAt = { text: END, own: [`Press Generate and read "${END}".`] };

describe('a drive whose goal quotes its end', () => {
  it('stops at the end once a check held, and says the goal was met', async () => {
    const drive = await runHarness(
      relentless,
      page(() => true, Verified.YES),
      {
        maxSteps: 10,
        endsAt,
      },
    );
    expect(drive.stopReason).toBe(StopReason.FINISHED);
    expect(drive.goalMet).toBe(true);
    expect(drive.steps).toBe(1);
  });

  it('keeps going while the end is not shown, and never stops on a check that failed', async () => {
    const hidden = await runHarness(
      relentless,
      page(() => false, Verified.YES),
      {
        maxSteps: 3,
        endsAt,
      },
    );
    expect(hidden.stopReason).toBe(StopReason.BUDGET);
    const failed = await runHarness(
      relentless,
      page(() => true, Verified.NO),
      {
        maxSteps: 3,
        endsAt,
      },
    );
    expect(failed.stopReason).toBe(StopReason.BUDGET);
  });
});
