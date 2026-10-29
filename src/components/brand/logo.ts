import type { SvgComponent } from 'astro/types';

// Logotipo oficial en SVG, si existe (src/assets/brand/logo.svg). Rutas fijas: Vite las
// resuelve al compilar. Solo el build de las pruebas e2e usa un logotipo de prueba, para
// verificar este camino sin tocar los archivos reales.
const logos = __KYRO_TEST_LOGO__
  ? import.meta.glob<{ default: SvgComponent }>('/tests/fixtures/brand/logo.svg', { eager: true })
  : import.meta.glob<{ default: SvgComponent }>('/src/assets/brand/logo.svg', { eager: true });

export const OfficialLogo: SvgComponent | undefined = Object.values(logos)[0]?.default;
