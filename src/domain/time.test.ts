import { describe, expect, it } from "vitest";
import {
  addDays,
  addMonths,
  dayKeyOf,
  dayRange,
  formatDayLabel,
  fromLocalInputs,
  isDayKey,
  monthRange,
  rangeForPreset,
  startOfDay,
  toLocalInputs,
} from "./time";

describe("Asia/Tashkent kunlari", () => {
  it("UTC yarim kechasi Toshkentda ertalab 05:00", () => {
    expect(startOfDay("2026-10-24").toISOString()).toBe("2026-10-23T19:00:00.000Z");
  });

  it("dayKeyOf Toshkent kunini qaytaradi (UTC bo'yicha emas)", () => {
    // UTC 23:30 — Toshkentda allaqachon ertasi kun 04:30
    expect(dayKeyOf(new Date("2026-10-23T23:30:00.000Z"))).toBe("2026-10-24");
    // UTC 18:59 — Toshkentda hali 23:59
    expect(dayKeyOf(new Date("2026-10-23T18:59:59.000Z"))).toBe("2026-10-23");
    expect(dayKeyOf(new Date("2026-10-23T19:00:00.000Z"))).toBe("2026-10-24");
  });

  it("fromLocalInputs va toLocalInputs bir-birining teskarisi", () => {
    const d = fromLocalInputs("2026-10-24", "10:31");
    expect(d.toISOString()).toBe("2026-10-24T05:31:00.000Z");
    expect(toLocalInputs(d)).toEqual({ date: "2026-10-24", time: "10:31" });
  });

  it("noto'g'ri sana va vaqtni rad etadi", () => {
    expect(isDayKey("2026-02-30")).toBe(false);
    expect(isDayKey("2026-13-01")).toBe(false);
    expect(isDayKey("2026-10-24")).toBe(true);
    expect(() => startOfDay("bad")).toThrow();
    expect(() => fromLocalInputs("2026-10-24", "25:00")).toThrow();
  });

  it("dayRange yarim ochiq oraliq: [start, end)", () => {
    const { start, end } = dayRange("2026-10-24");
    expect(end.getTime() - start.getTime()).toBe(24 * 3600 * 1000);
    const r = dayRange("2026-10-24", "2026-10-26");
    expect(r.end.getTime() - r.start.getTime()).toBe(3 * 24 * 3600 * 1000);
  });
});

describe("oy arifmetikasi", () => {
  it("monthRange kabisa yilini hisobga oladi", () => {
    expect(monthRange("2028-02").days).toBe(29);
    expect(monthRange("2026-02").days).toBe(28);
    expect(monthRange("2026-10")).toMatchObject({ firstDay: "2026-10-01", lastDay: "2026-10-31", days: 31 });
  });

  it("addMonths yil chegarasidan o'tadi", () => {
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(addMonths("2026-12", 1)).toBe("2027-01");
    expect(addMonths("2026-10", 0)).toBe("2026-10");
  });

  it("addDays oy va yil chegarasidan o'tadi", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
});

describe("presetlar va yorliqlar", () => {
  const now = new Date("2026-10-24T05:31:00.000Z"); // Toshkent: 24-oktabr 10:31

  it("presetlar to'g'ri oraliq beradi", () => {
    expect(rangeForPreset("today", now)).toEqual({ from: "2026-10-24", to: "2026-10-24" });
    expect(rangeForPreset("yesterday", now)).toEqual({ from: "2026-10-23", to: "2026-10-23" });
    expect(rangeForPreset("7d", now)).toEqual({ from: "2026-10-18", to: "2026-10-24" });
    expect(rangeForPreset("30d", now)).toEqual({ from: "2026-09-25", to: "2026-10-24" });
    expect(rangeForPreset("this-month", now)).toEqual({ from: "2026-10-01", to: "2026-10-24" });
    expect(rangeForPreset("last-month", now)).toEqual({ from: "2026-09-01", to: "2026-09-30" });
    expect(rangeForPreset("year", now)).toEqual({ from: "2026-01-01", to: "2026-10-24" });
  });

  it("kun yorliqlari", () => {
    expect(formatDayLabel("2026-10-24", "2026-10-24")).toBe("Bugun");
    expect(formatDayLabel("2026-10-23", "2026-10-24")).toBe("Kecha");
    expect(formatDayLabel("2026-10-20", "2026-10-24")).toBe("20-oktabr, seshanba");
    expect(formatDayLabel("2025-12-31", "2026-10-24")).toBe("2025-yil 31-dekabr, chorshanba");
  });
});
