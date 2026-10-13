/**
 * Which checks read too early: the ONE rule every fold of a run's checks applies.
 *
 * A passive check (an assert, made after acting rather than declared before it) that came back `no`
 * is superseded when the SAME claim holds later in the same run. Driven over MCP: the Harness
 * asserted the text Generate produces before its POST answered, read `no`, and a working journey
 * was failed while the same assert held a second later.
 *
 * It lived in four places — the Harness's tally, the run's verdict, the synced run's flow status and
 * the session's result block — each keyed differently and one not at all, so one end-of-session
 * answer could carry `claim: pass` beside "Reticle result: failed". Every fold calls this instead.
 *
 * A DECLARED check that failed is never excused: a first click that did nothing is a finding even if
 * a second one works. A `no` AFTER a `yes` on the same claim is never excused either: that is a
 * regression inside the run.
 */

/** One check, as a fold reads it. */
export interface CheckReading {
  /** The claim: two readings with the same key are the same claim. */
  readonly key: string;
  /** Made after acting (an assert), rather than declared before the action it judges. */
  readonly passive: boolean;
  /** Came back `yes`. */
  readonly held: boolean;
  /** Came back `no`. Neither is undecided. */
  readonly failed: boolean;
}

/** The indexes, into `readings`, of the passive `no`s a later `yes` of the same claim supersedes. */
export function supersededChecks(readings: readonly CheckReading[]): ReadonlySet<number> {
  const superseded = new Set<number>();
  for (const [at, reading] of readings.entries()) {
    if (!reading.passive || !reading.failed) continue;
    const heldLater = readings
      .slice(at + 1)
      .some((later) => later.key === reading.key && later.held);
    if (heldLater) superseded.add(at);
  }
  return superseded;
}
