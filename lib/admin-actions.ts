"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { sql } from "./db";
import { ADMIN_COOKIE, adminSessionValue, checkPassword, isAdmin, KYC } from "./admin";

export async function adminLogin(_prev: { error?: string }, form: FormData): Promise<{ error?: string }> {
  // Atraso fixo deixa chute de senha lento.
  await new Promise((r) => setTimeout(r, 600));
  if (!checkPassword(String(form.get("password") ?? ""))) return { error: "Senha incorreta." };
  (await cookies()).set(ADMIN_COOKIE, adminSessionValue()!, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  redirect("/admin");
}

export async function adminLogout() {
  (await cookies()).delete(ADMIN_COOKIE);
  redirect("/admin");
}

export async function adminToggleAgent(form: FormData) {
  if (!(await isAdmin())) return;
  await sql`update agents set active = not active where id = ${Number(form.get("id"))}`;
  revalidatePath("/admin");
}

export async function adminSetKyc(form: FormData) {
  if (!(await isAdmin())) return;
  const status = String(form.get("kyc"));
  if (!(status in KYC)) return;
  await sql`update agents set kyc_status = ${status}, kyc_updated_at = now() where id = ${Number(form.get("id"))}`;
  revalidatePath("/admin");
}
