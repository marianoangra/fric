import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

const REF_COOKIE = "fric_ref";

// Link de convite: fric.com.br/r/<slug-da-ia>. Guarda quem convidou por 30 dias e leva para a home.
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const slug = (await params).slug.toLowerCase().slice(0, 60);
  const res = NextResponse.redirect(new URL("/", req.url), 307);
  const [a] = await sql`select slug from agents where slug = ${slug} and not demo`;
  if (a) {
    res.cookies.set(REF_COOKIE, a.slug, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  }
  return res;
}
