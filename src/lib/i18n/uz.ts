/**
 * O'zbekcha (lotin) matnlar. Keyinchalik boshqa tillar shu shaklda qo'shiladi
 * (`ru.ts`, `en.ts`) va `index.ts` til bo'yicha tanlaydi.
 */
export const uz = {
  appName: "KunHisob",
  tagline: "Shaxsiy moliya tizimi",

  nav: {
    home: "Bosh sahifa",
    transactions: "Tranzaksiyalar",
    accounts: "Hisoblar",
    analytics: "Tahlil",
    plan: "Reja",
    more: "Yana",
    settings: "Sozlamalar",
    add: "Qo‘shish",
  },

  txType: {
    INCOME: "Daromad",
    EXPENSE: "Xarajat",
    REFUND: "Qaytim",
    ADJUSTMENT: "Tuzatish",
    TRANSFER: "O‘tkazma",
    DEBT_LEND: "Qarz berildi",
    DEBT_BORROW: "Qarz olindi",
    DEBT_REPAY_IN: "Qarz qaytdi",
    DEBT_REPAY_OUT: "Qarz qaytarildi",
  } as Record<string, string>,

  accountType: {
    CASH: "Naqd pul",
    CARD: "Bank kartasi",
    SAVINGS: "Jamg‘arma",
    OTHER: "Boshqa",
  } as Record<string, string>,

  theme: { LIGHT: "Yorug‘", DARK: "Qorong‘i", SYSTEM: "Tizim" } as Record<string, string>,
  motion: {
    FULL: "To‘liq",
    REDUCED: "Kamaytirilgan",
    OFF: "O‘chiq",
  } as Record<string, string>,

  common: {
    save: "Saqlash",
    cancel: "Bekor qilish",
    delete: "O‘chirish",
    edit: "Tahrirlash",
    undo: "Qaytarish",
    close: "Yopish",
    back: "Orqaga",
    next: "Davom etish",
    loading: "Yuklanmoqda…",
    search: "Qidirish",
    all: "Hammasi",
    today: "Bugun",
    yesterday: "Kecha",
    other: "Boshqa",
    retry: "Qayta urinish",
    noCategory: "Kategoriyasiz",
  },

  presets: {
    today: "Bugun",
    yesterday: "Kecha",
    "7d": "7 kun",
    "30d": "30 kun",
    "this-month": "Joriy oy",
    "last-month": "Oldingi oy",
    year: "Yil",
  } as Record<string, string>,
} as const;

export type Dict = typeof uz;
