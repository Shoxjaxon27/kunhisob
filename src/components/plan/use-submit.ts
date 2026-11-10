"use client";

import { useState } from "react";
import type { ActionResult } from "@/server/action-utils";

/** Forma yuborish holati: band, umumiy xato va maydon xatolari. */
export function useSubmit() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  const reset = () => {
    setError(null);
    setFields({});
  };

  async function submit<T>(fn: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
    setBusy(true);
    reset();
    try {
      const res = await fn();
      if (!res.ok) {
        setError(res.error);
        setFields(res.fields ?? {});
      }
      return res;
    } finally {
      setBusy(false);
    }
  }
  return { busy, error, fields, submit, reset };
}
