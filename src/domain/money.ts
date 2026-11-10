/**
 * Pul arifmetikasi — floating-point ishlatilmaydi.
 *
 * Barcha summalar `bigint` ko'rinishida "minor unit"da (UZS: tiyin, USD: cent) saqlanadi.
 * Bu modul brauzerda ham, serverda ham ishlaydi (Node API ishlatilmaydi).
 */

export const CURRENCIES = {
  UZS: { code: "UZS", minorUnit: 2, symbol: "so‘m", name: "O‘zbek so‘mi" },
  USD: { code: "USD", minorUnit: 2, symbol: "$", name: "AQSH dollari" },
} as const;

export type CurrencyCode = keyof typeof CURRENCIES;
export const CURRENCY_CODES = Object.keys(CURRENCIES) as CurrencyCode[];

export function isCurrency(value: unknown): value is CurrencyCode {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(CURRENCIES, value);
}

/** 10^15 minor unit (= 10 trillion major). Undan katta summalar rad etiladi. */
export const MAX_MINOR = 1_000_000_000_000_000n;

export type MoneyErrorCode =
  | "empty"
  | "invalid"
  | "negative"
  | "too_many_decimals"
  | "too_large"
  | "invalid_rate";

export class MoneyError extends Error {
  constructor(
    public readonly code: MoneyErrorCode,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "MoneyError";
  }
}

function pow10(n: number): bigint {
  return 10n ** BigInt(n);
}

/**
 * Foydalanuvchi kiritgan matnni minor unitga aylantiradi.
 *
 * Qabul qilinadi: "1250000", "1 250 000", "1,250,000", "1 250 000,50", "1250.5", "12,50".
 * Qoida: oxirgi ajratgich o'nlik hisoblanadi, agar undan keyin 1..minorUnit ta raqam bo'lsa
 * va (bitta ajratgich bo'lsa) aynan 3 ta raqam bo'lmasa. Aynan 3 raqam — minglik ajratgich.
 * Manfiy summa va noaniq kiritishlar rad etiladi (taxmin qilinmaydi).
 */
export function parseMoney(input: string, currency: CurrencyCode): bigint {
  const mu = CURRENCIES[currency].minorUnit;
  const raw = input.trim();
  if (raw === "") throw new MoneyError("empty");
  if (raw.startsWith("-") || raw.startsWith("−")) throw new MoneyError("negative");

  const s = raw.replace(/[\s  ]/g, "");
  if (!/^[0-9]+([.,][0-9]+)*$|^[0-9]*[.,][0-9]+$/.test(s) && !/^[0-9]+$/.test(s)) {
    throw new MoneyError("invalid");
  }

  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  const lastSep = Math.max(lastComma, lastDot);

  let intRaw: string;
  let fracRaw = "";

  if (lastSep === -1) {
    intRaw = s;
  } else {
    const sepChar = s[lastSep] as string;
    const hasOtherType = sepChar === "," ? lastDot !== -1 : lastComma !== -1;
    const sameCount = s.split(sepChar).length - 1;
    const after = s.slice(lastSep + 1);
    const before = s.slice(0, lastSep);

    let isDecimal: boolean;
    if (hasOtherType) {
      // Ikkala turdagi ajratgich bor: oxirgisi o'nlik, qolganlari guruhlash.
      isDecimal = true;
    } else if (sameCount > 1) {
      // Bir xil ajratgich takrorlangan: guruhlash ("1,250,000").
      isDecimal = false;
    } else if (after.length === 3) {
      // Bitta ajratgich + aynan 3 raqam: minglik ("1,250"). "0,125" kabi holat esa noaniq.
      if (before === "0" || before === "") throw new MoneyError("too_many_decimals");
      isDecimal = false;
    } else {
      isDecimal = true;
    }

    if (isDecimal) {
      intRaw = before.replace(/[.,]/g, "");
      fracRaw = after;
    } else {
      const groups = s.split(sepChar);
      // Guruhlar 3 xonali bo'lishi shart (birinchisidan tashqari).
      if (!groups.slice(1).every((g) => g.length === 3)) throw new MoneyError("invalid");
      intRaw = groups.join("");
    }
  }

  if (intRaw === "") intRaw = "0";
  if (fracRaw.length > mu) throw new MoneyError("too_many_decimals");
  const frac = fracRaw.padEnd(mu, "0");
  const minor = BigInt(intRaw) * pow10(mu) + (frac === "" ? 0n : BigInt(frac));
  if (minor > MAX_MINOR) throw new MoneyError("too_large");
  return minor;
}

export function tryParseMoney(input: string, currency: CurrencyCode): bigint | null {
  try {
    return parseMoney(input, currency);
  } catch {
    return null;
  }
}

function groupDigits(digits: string, sep: string): string {
  let out = "";
  for (let i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 === 0) out += sep;
    out += digits[i];
  }
  return out;
}

export type FormatOptions = {
  /** "always": +/− doim; "negative": faqat manfiyda; "never": belgisiz. Default: "negative". */
  sign?: "always" | "negative" | "never";
  /** Valyuta belgisini qo'shish. Default: true. */
  symbol?: boolean;
};

const MINUS = "−"; // U+2212 — matematik minus (chiziqcha emas)

/** Deterministik formatlash (Intl locale farqlariga bog'liq emas). */
export function formatMoney(minor: bigint | number, currency: CurrencyCode, opts: FormatOptions = {}): string {
  const { sign = "negative", symbol = true } = opts;
  const value = typeof minor === "number" ? BigInt(Math.round(minor)) : minor;
  const cur = CURRENCIES[currency];
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const divisor = pow10(cur.minorUnit);
  const major = abs / divisor;
  const frac = abs % divisor;

  const groupSep = currency === "USD" ? "," : " ";
  let text = groupDigits(major.toString(), groupSep);

  if (currency === "USD") {
    text += "." + frac.toString().padStart(cur.minorUnit, "0");
  } else if (frac !== 0n) {
    text += "," + frac.toString().padStart(cur.minorUnit, "0");
  }

  let prefix = "";
  if (negative && sign !== "never") prefix = MINUS;
  else if (!negative && sign === "always" && abs !== 0n) prefix = "+";

  if (!symbol) return prefix + text;
  return currency === "USD" ? `${prefix}$${text}` : `${prefix}${text} ${cur.symbol}`;
}

/** Faqat grafik/ko'rsatish uchun. Hisob-kitobda ISHLATILMAYDI. */
export function toMajorNumber(minor: bigint | number, currency: CurrencyCode): number {
  return Number(minor) / 10 ** CURRENCIES[currency].minorUnit;
}

/** Input maydoni uchun: minor → tahrirlanadigan matn ("1250000" yoki "1250000,5"). */
export function minorToInput(minor: bigint, currency: CurrencyCode): string {
  const mu = CURRENCIES[currency].minorUnit;
  const divisor = pow10(mu);
  const major = minor / divisor;
  const frac = minor % divisor;
  if (frac === 0n) return major.toString();
  return `${major}.${frac.toString().padStart(mu, "0").replace(/0+$/, "")}`;
}

export function sumMinor(values: readonly bigint[]): bigint {
  let total = 0n;
  for (const v of values) total += v;
  return total;
}

// ───────────────────────── Kurs (valyuta almashtirish) ─────────────────────────

const RATE_SCALE = 8;

/** Kurs matnini ("12650", "12 650,5") scaled bigint ga aylantiradi (8 xona). */
export function parseRate(input: string): bigint {
  const s = input.trim().replace(/[\s  ]/g, "").replace(",", ".");
  if (!/^[0-9]+(\.[0-9]+)?$/.test(s)) throw new MoneyError("invalid_rate");
  const [i = "0", f = ""] = s.split(".");
  if (f.length > RATE_SCALE) throw new MoneyError("invalid_rate");
  const scaled = BigInt(i) * pow10(RATE_SCALE) + BigInt(f.padEnd(RATE_SCALE, "0"));
  if (scaled <= 0n) throw new MoneyError("invalid_rate");
  return scaled;
}

function divRound(num: bigint, den: bigint): bigint {
  // faqat musbat sonlar uchun, yarmi — yuqoriga
  return (num + den / 2n) / den;
}

/**
 * `from` valyutadagi summani kurs bo'yicha `to` valyutaga o'tkazadi.
 * Kurs: 1 (from major) = rate (to major).
 */
export function convertMinor(amount: bigint, from: CurrencyCode, to: CurrencyCode, rateScaled: bigint): bigint {
  const muFrom = CURRENCIES[from].minorUnit;
  const muTo = CURRENCIES[to].minorUnit;
  return divRound(amount * rateScaled * pow10(muTo), pow10(RATE_SCALE) * pow10(muFrom));
}

/**
 * Ikki summadan kelib chiqadigan kurs (matn). Masalan 100 USD → 1 265 000 UZS => "12650".
 * Kurs o'ylab topilmaydi: faqat foydalanuvchi kiritgan ikkala summadan hisoblanadi.
 */
export function impliedRate(
  fromMinor: bigint,
  from: CurrencyCode,
  toMinor: bigint,
  to: CurrencyCode,
): string | null {
  if (fromMinor <= 0n || toMinor <= 0n) return null;
  const muFrom = CURRENCIES[from].minorUnit;
  const muTo = CURRENCIES[to].minorUnit;
  const digits = 6;
  const scaled = divRound(toMinor * pow10(muFrom) * pow10(digits), fromMinor * pow10(muTo));
  const s = scaled.toString().padStart(digits + 1, "0");
  const intPart = s.slice(0, s.length - digits);
  const fracPart = s.slice(s.length - digits).replace(/0+$/, "");
  return fracPart ? `${intPart}.${fracPart}` : intPart;
}
