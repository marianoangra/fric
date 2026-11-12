import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/painel/", "/api/", "/admin", "/minha-ia", "/entrar"] },
    sitemap: "https://www.fric.com.br/sitemap.xml",
  };
}
