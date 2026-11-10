"use client";

import { Plus } from "lucide-react";
import { useQuickAdd } from "@/components/quick-add/quick-add";

export function ExpenseButton() {
  const { open } = useQuickAdd();
  return <button className="btn btn-primary" onClick={() => open({ mode: "EXPENSE" })}><Plus size={18} />Xarajat qo‘shish</button>;
}
