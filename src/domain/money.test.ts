import { describe, expect, it } from "vitest";
import {
  MoneyError,
  convertMinor,
  formatMoney,
  impliedRate,
  minorToInput,
  parseMoney,
  parseRate,
  sumMinor,
  tryParseMoney,
} from "./money";

describe("parseMoney", () => {
  it("butun sonlarni minor unitga aylantiradi", () => {
    expect(parseMoney("1250000", "UZS")).toBe(125_000_000n);
    expect(parseMoney("0", "UZS")).toBe(0n);
    expect(parseMoney("5", "USD")).toBe(500n);
  });

  it("bo'sh joy (oddiy va non-breaking) bilan guruhlangan sonlarni o'qiydi", () => {
    expect(parseMoney("1 250 000", "UZS")).toBe(125_000_000n);
    expect(parseMoney("1 250 000", "UZS")).toBe(125_000_000n);
  });

  it("o'nlik ajratgichni (vergul yoki nuqta) to'g'ri aniqlaydi", () => {
    expect(parseMoney("12,50", "USD")).toBe(1250n);
    expect(parseMoney("12.5", "USD")).toBe(1250n);
    expect(parseMoney("1 250 000,5", "UZS")).toBe(125_000_050n);
    expect(parseMoney("1,250,000.50", "UZS")).toBe(125_000_050n);
    expect(parseMoney("1.250.000,50", "UZS")).toBe(125_000_050n);
    expect(parseMoney(".5", "USD")).toBe(50n);
  });

  it("aynan 3 raqamli bitta ajratgichni minglik deb hisoblaydi", () => {
    expect(parseMoney("1,250", "UZS")).toBe(125_000n);
    expect(parseMoney("1.250", "UZS")).toBe(125_000n);
    expect(parseMoney("1,250,000", "UZS")).toBe(125_000_000n);
  });

  it("noaniq yoki noto'g'ri kiritishni rad etadi", () => {
    expect(() => parseMoney("", "UZS")).toThrow(MoneyError);
    expect(() => parseMoney("abc", "UZS")).toThrow(MoneyError);
    expect(() => parseMoney("-5", "UZS")).toThrow(/negative/);
    expect(() => parseMoney("0,125", "USD")).toThrow(/too_many_decimals/);
    expect(() => parseMoney("1,2345", "USD")).toThrow(/too_many_decimals/);
    expect(() => parseMoney("1,25,000", "UZS")).toThrow(MoneyError);
    expect(() => parseMoney("1e5", "UZS")).toThrow(MoneyError);
    expect(() => parseMoney("12 3a", "UZS")).toThrow(MoneyError);
  });

  it("juda katta summani rad etadi", () => {
    expect(() => parseMoney("99999999999999999", "UZS")).toThrow(/too_large/);
  });

  it("tryParseMoney xatoda null qaytaradi", () => {
    expect(tryParseMoney("xx", "UZS")).toBeNull();
    expect(tryParseMoney("10", "USD")).toBe(1000n);
  });
});

describe("formatMoney", () => {
  it("UZS: minglik ajratgich va so'm belgisi", () => {
    expect(formatMoney(125_000_000n, "UZS")).toBe("1 250 000 so‘m");
    expect(formatMoney(125_000_050n, "UZS")).toBe("1 250 000,50 so‘m");
    expect(formatMoney(0n, "UZS", { symbol: false })).toBe("0");
  });

  it("USD: doim 2 xona", () => {
    expect(formatMoney(123_456n, "USD")).toBe("$1,234.56");
    expect(formatMoney(100n, "USD")).toBe("$1.00");
  });

  it("belgilar rangga emas, matnga tayanadi", () => {
    expect(formatMoney(-5000n, "UZS", { symbol: false })).toBe("−50");
    expect(formatMoney(5000n, "UZS", { sign: "always", symbol: false })).toBe("+50");
    expect(formatMoney(-5000n, "UZS", { sign: "never", symbol: false })).toBe("50");
    expect(formatMoney(0n, "UZS", { sign: "always", symbol: false })).toBe("0");
  });
});

describe("minorToInput", () => {
  it("tahrirlash uchun matn qaytaradi va parseMoney bilan aylana hosil qiladi", () => {
    for (const v of [0n, 1n, 50n, 100n, 125_000_050n, 99n]) {
      expect(parseMoney(minorToInput(v, "UZS"), "UZS")).toBe(v);
    }
    expect(minorToInput(1250n, "USD")).toBe("12.5");
  });
});

describe("sumMinor", () => {
  it("0.1 + 0.2 kabi floating xatolar bo'lmaydi", () => {
    const a = parseMoney("0.10", "USD");
    const b = parseMoney("0.20", "USD");
    expect(sumMinor([a, b])).toBe(parseMoney("0.30", "USD"));
  });
});

describe("kurs", () => {
  it("parseRate kursni 8 xonali scaled songa aylantiradi", () => {
    expect(parseRate("12650")).toBe(1_265_000_000_000n);
    expect(parseRate("12 650,5")).toBe(1_265_050_000_000n);
    expect(() => parseRate("0")).toThrow(MoneyError);
    expect(() => parseRate("abc")).toThrow(MoneyError);
    expect(() => parseRate("1.123456789")).toThrow(MoneyError);
  });

  it("convertMinor yaxlitlashni to'g'ri bajaradi", () => {
    // 100 USD * 12650 = 1 265 000 UZS
    expect(convertMinor(10_000n, "USD", "UZS", parseRate("12650"))).toBe(126_500_000n);
    // 1 000 000 UZS / 12650 ≈ 79.05 USD  (kurs teskari: 1 UZS = 0.00007905 USD)
    expect(convertMinor(100_000_000n, "UZS", "USD", parseRate("0.00007905"))).toBe(7905n);
  });

  it("impliedRate ikkala summadan kursni hisoblaydi", () => {
    expect(impliedRate(10_000n, "USD", 126_500_000n, "UZS")).toBe("12650");
    expect(impliedRate(10_000n, "USD", 126_525_000n, "UZS")).toBe("12652.5");
    expect(impliedRate(0n, "USD", 100n, "UZS")).toBeNull();
  });
});
