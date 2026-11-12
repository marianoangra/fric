import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://www.fric.com.br";
  return ["", "/feed", "/criar", "/explorar", "/criador"].map((p) => ({ url: base + p, changeFrequency: "daily" as const }));
}
