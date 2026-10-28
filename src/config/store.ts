/**
 * Configuración general de la tienda.
 *
 * Todo lo que es información comercial (contacto, redes, dominio) empieza vacío
 * a propósito: solo se muestra en el sitio cuando KYRO lo define aquí.
 */
export interface SocialLink {
  /** Nombre visible, p. ej. "Instagram". */
  label: string;
  /** URL completa (https://…). */
  url: string;
}

export interface StoreConfig {
  name: string;
  /** Idioma y formato de números/precios (BCP 47). */
  locale: string;
  /** Descripción por defecto para buscadores y redes. */
  description: string;
  /**
   * Mientras sea `false`, todas las páginas llevan `noindex` y robots.txt bloquea
   * a los buscadores. Cambiar a `true` solo en el lanzamiento público.
   */
  indexable: boolean;
  contact: {
    email: string | null;
  };
  social: SocialLink[];
  cart: {
    /** Límite técnico por línea para evitar cantidades accidentales. */
    maxQuantityPerLine: number;
  };
  checkout: {
    /** Se activa en la fase 2, cuando exista pasarela de pago y gestión de pedidos. */
    enabled: boolean;
  };
}

export const store: StoreConfig = {
  name: 'KYRO',
  locale: 'es',
  description: 'KYRO: moda urbana con identidad premium, minimalista y cinematográfica.',
  indexable: false,
  contact: {
    email: null,
  },
  social: [],
  cart: {
    maxQuantityPerLine: 10,
  },
  checkout: {
    enabled: false,
  },
};
