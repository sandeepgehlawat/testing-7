import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://chaintax.app";
  const now = new Date();
  return [
    { url: base,                lastModified: now, changeFrequency: "weekly", priority: 1.0 },
    { url: `${base}/#agent`,    lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/#install`,  lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/#countries`,lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/#privacy`,  lastModified: now, changeFrequency: "monthly", priority: 0.6 },
  ];
}
