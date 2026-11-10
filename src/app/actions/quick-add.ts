"use server";
import { requireUserId } from "@/server/auth/current";
import { getQuickAddContext } from "@/server/services/quick-add";
import { getDb } from "@/server/db";

export async function loadQuickAdd() {
  return getQuickAddContext(getDb(), await requireUserId());
}
