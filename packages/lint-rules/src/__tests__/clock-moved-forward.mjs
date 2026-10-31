// Imported into every Node process a run starts (cli-runs.ts puts it in NODE_OPTIONS), never by a test. It moves the
// clock forward by the months the variable below names: `Date.now()`, `new Date()` and `Date()` all read the later
// time, as browserslist does when it judges how old its browser data is. Plain JS, as
// another-writer-as-oxlint-lint-run-ends.mjs is.

// Set by cli-runs.ts, under the same name there: a whole number of months.
const MONTHS_VARIABLE = 'AGENTS_INC_TEST_CLOCK_MONTHS_AHEAD'

function moveTheClockForward(monthsAhead) {
  const RealDate = Date
  const now = new RealDate()
  const later = RealDate.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth() + monthsAhead,
    now.getUTCDate(),
    now.getUTCHours(),
    now.getUTCMinutes(),
    now.getUTCSeconds(),
    now.getUTCMilliseconds(),
  )
  const aheadMs = later - now.getTime()
  function laterNow() {
    return RealDate.now() + aheadMs
  }

  // eslint-disable-next-line unicorn/no-global-object-property-assignment -- browserslist and every other module in the process read the clock through the global Date, which is the only place a preload can move it for them
  globalThis.Date = new Proxy(RealDate, {
    construct(target, args, constructedClass) {
      return Reflect.construct(target, args.length === 0 ? [laterNow()] : args, constructedClass)
    },
    apply() {
      return new RealDate(laterNow()).toString()
    },
    get(target, key, receiver) {
      return key === 'now' ? laterNow : Reflect.get(target, key, receiver)
    },
  })
}

const months = process.env[MONTHS_VARIABLE]

if (months !== undefined) moveTheClockForward(Number(months))
