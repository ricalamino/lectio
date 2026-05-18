import { describe, expect, it } from "vitest";
import { parseDateExpression, resolveReferenceDate } from "./reference-date.js";

const anchor = new Date("2026-05-18T15:30:00Z"); // Monday

describe("parseDateExpression", () => {
  it("returns ISO when input is already ISO", () => {
    expect(parseDateExpression("2026-07-01", anchor)).toBe("2026-07-01");
    expect(parseDateExpression("2026-07-01T10:00:00Z", anchor)).toBe("2026-07-01");
  });

  it("resolves tomorrow/yesterday/today", () => {
    expect(parseDateExpression("tomorrow", anchor)).toBe("2026-05-19");
    expect(parseDateExpression("yesterday", anchor)).toBe("2026-05-17");
    expect(parseDateExpression("today", anchor)).toBe("2026-05-18");
  });

  it("resolves 'in N days/weeks'", () => {
    expect(parseDateExpression("in 3 days", anchor)).toBe("2026-05-21");
    expect(parseDateExpression("in 2 weeks", anchor)).toBe("2026-06-01");
  });

  it("resolves bare weekday to the next occurrence", () => {
    // Monday anchor → Friday is +4
    expect(parseDateExpression("friday", anchor)).toBe("2026-05-22");
    expect(parseDateExpression("by Friday", anchor)).toBe("2026-05-22");
  });

  it("resolves 'next <weekday>' as following week", () => {
    expect(parseDateExpression("next monday", anchor)).toBe("2026-05-25");
  });

  it("resolves month-day expressions", () => {
    expect(parseDateExpression("July 4", anchor)).toBe("2026-07-04");
    expect(parseDateExpression("Jul 4, 2027", anchor)).toBe("2027-07-04");
  });

  it("falls forward when bare month-day is in the past", () => {
    // March 1 with May anchor → next year
    expect(parseDateExpression("March 1", anchor)).toBe("2027-03-01");
  });

  it("returns null for unparseable input", () => {
    expect(parseDateExpression("eventually", anchor)).toBeNull();
    expect(parseDateExpression("", anchor)).toBeNull();
  });
});

describe("resolveReferenceDate", () => {
  it("uses entities.dates when present", () => {
    expect(
      resolveReferenceDate(
        { entities: { dates: ["next Friday"] }, suggested_action: null },
        anchor,
      ),
    ).toBe("2026-05-29");
  });

  it("falls back to suggested_action.when", () => {
    expect(
      resolveReferenceDate(
        {
          entities: {},
          suggested_action: { verb: "call", what: "x", when: "tomorrow" },
        },
        anchor,
      ),
    ).toBe("2026-05-19");
  });

  it("falls back to capturedAt date", () => {
    expect(
      resolveReferenceDate({ entities: {}, suggested_action: null }, anchor),
    ).toBe("2026-05-18");
  });

  it("skips unparseable entries and tries the next", () => {
    expect(
      resolveReferenceDate(
        {
          entities: { dates: ["eventually", "Jul 4"] },
          suggested_action: null,
        },
        anchor,
      ),
    ).toBe("2026-07-04");
  });
});
