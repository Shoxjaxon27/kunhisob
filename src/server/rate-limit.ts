/**
 * Oddiy xotiradagi (jarayon ichidagi) tezlik cheklovi — login urinishlari uchun.
 * Bitta serverli lokal o'rnatish uchun yetarli; ko'p serverli muhitda umumiy omborga o'tkaziladi.
 */
type Bucket = { count: number; resetAt: number };

export class RateLimiter {
  private buckets = new Map<string, Bucket>();

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
  ) {}

  /** true — ruxsat, false — limit oshgan. */
  hit(key: string, now: number = Date.now()): boolean {
    const b = this.buckets.get(key);
    if (!b || b.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + this.windowMs });
      this.gc(now);
      return true;
    }
    b.count += 1;
    return b.count <= this.max;
  }

  reset(key: string): void {
    this.buckets.delete(key);
  }

  retryAfterMs(key: string, now: number = Date.now()): number {
    const b = this.buckets.get(key);
    return b ? Math.max(0, b.resetAt - now) : 0;
  }

  private gc(now: number): void {
    if (this.buckets.size < 500) return;
    for (const [k, b] of this.buckets) if (b.resetAt <= now) this.buckets.delete(k);
  }
}

/** 15 daqiqada 8 ta noto'g'ri urinish. */
export const loginLimiter = new RateLimiter(8, 15 * 60 * 1000);
