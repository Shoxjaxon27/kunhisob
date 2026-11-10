export type AppErrorCode =
  | "validation"
  | "not_found"
  | "conflict"
  | "unauthorized"
  | "forbidden"
  | "rate_limited"
  | "internal";

/** Foydalanuvchiga ko'rsatish xavfsiz bo'lgan xato (xabar o'zbek tilida). */
export class AppError extends Error {
  constructor(
    public readonly code: AppErrorCode,
    message: string,
    public readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function validationError(field: string, message: string): AppError {
  return new AppError("validation", message, { [field]: message });
}
