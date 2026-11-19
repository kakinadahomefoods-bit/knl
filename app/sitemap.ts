import type { MetadataRoute } from 'next';

// Only stable public routes are listed; product URLs require a separate,
// failure-tolerant catalogue-backed sitemap before they can be included.
export default function sitemap(): MetadataRoute.Sitemap {
  return ['', '/shop', '/about', '/contact', '/policies'].map((route) => ({
    url: `https://www.cruvitacookies.com${route}`,
  }));
}
