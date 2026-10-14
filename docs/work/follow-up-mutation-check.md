# Follow-up: the break-one-line check

**What.** After implementing, a script breaks each new decision point one line at a time and asserts
that a test fails for each break. The standards are in `CLAUDE.md` → "Tests".

**Why.** Review rounds 4, 5 and 6 of the editor-set merges each broke lines by hand and found some
that no test caught (`questions.md` #50, `status.md` rounds 4 to 6).

**State.** The break scripts lived only in the session scratchpad and were lost when the session
restarted on 2026-10-11. Nothing is committed.

**Open.** The owner (2026-10-11) wants a committed check, but it is not specific to this repo. Find
out how agents-inc (the `~/dev/cli` monorepo) should ship it to other projects: as a skill, a shared
package, or a step in the agents it generates, and who owns it. Give a session started in that repo
this prompt:

```text
Research and propose; do not implement. Read CLAUDE.md first; every git write is mine.

In the lint-rules repo, review rounds kept finding lines no test caught: a reviewer broke one line
of new code by hand and every test still passed. I want the process to catch this: after
implementing, a script breaks each new decision point one line at a time and asserts a test fails
for each break.

Find out how to add this to the SDLC our agents follow (tester, developer and reviewer steps) and
ship it to other projects: as a skill, a shared package, a step in the generated agents, or a mix.
Say who owns it and when it runs. It must carry these standards:
- Serve the broken module without writing the source file (a Vite `load` hook, for example).
- A break no test catches gets a test, or a verdict that it "changes nothing" backed by a run of
  the real tool on the exact config the break writes.
- Before counting caught breaks, the unbroken run is clean or its failures are explained, and the
  scratch copy builds whatever the tests load (tests on built output never see a source break).
- Inside an `it.fails` test, nothing but the assertion may throw: run the tool in `beforeAll`, or
  the test "passes" when the tool itself crashes.

Report the options with their trade-offs (including doing nothing), your recommendation, the files
it would add or change, and anything in this prompt that proved false.
```
