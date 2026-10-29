export interface Crumb {
  name: string;
  /** Ruta interna, ya con `base` (p. ej. el resultado de routes.shop()). */
  path: string;
}

/**
 * Migas de pan para buscadores (schema.org BreadcrumbList). Exigen URLs absolutas,
 * así que sin dominio definido (KYRO_SITE_URL) no se generan.
 */
export function breadcrumbJsonLd(crumbs: Crumb[], site: URL | undefined) {
  if (!site || crumbs.length === 0) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.name,
      item: new URL(crumb.path, site).href,
    })),
  };
}
