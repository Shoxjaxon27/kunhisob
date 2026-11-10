"use client";

import { ErrorState } from "@/components/ui/empty-state";

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="card">
      <ErrorState
        description="Sahifani yuklab bo‘lmadi. Ma’lumotlaringiz saqlangan — qayta urinib ko‘ring."
        action={<button type="button" className="btn btn-primary" onClick={reset}>Qayta urinish</button>}
      />
    </div>
  );
}
