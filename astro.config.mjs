// @ts-check
import { defineConfig, fontProviders } from 'astro/config';

// `KYRO_CATALOG=fixtures` (vía `npm run dev:fixtures` / `build:fixtures`) carga los
// datos de prueba de tests/fixtures. Se compila en otra carpeta para que nunca pueda
// confundirse con el build de producción en dist/.
const useFixtures = process.env.KYRO_CATALOG === 'fixtures';
// `KYRO_TEST_LOGO=1` (solo `npm run build:e2e`) añade el logotipo de prueba para
// verificar el uso de un SVG oficial. La demostración muestra el logotipo real.
const useTestLogo = useFixtures && process.env.KYRO_TEST_LOGO === '1';

export default defineConfig({
  // URL pública definitiva. Se define cuando exista dominio; mientras tanto no hay
  // URLs canónicas absolutas.
  ...(process.env.KYRO_SITE_URL ? { site: process.env.KYRO_SITE_URL } : {}),
  // Prefijo de ruta, p. ej. "/kyro-store" si algún día se sirve una vista previa
  // desde un subdirectorio. Todos los enlaces internos pasan por src/lib/urls.ts.
  base: process.env.KYRO_BASE_PATH || '/',
  trailingSlash: 'always',
  output: 'static',
  outDir: useTestLogo ? './.e2e-dist' : useFixtures ? './.fixtures-dist' : './dist',

  security: {
    csp: {
      // Astro añade script-src y style-src con hashes de cada página.
      directives: [
        "default-src 'self'",
        "img-src 'self' data:",
        "font-src 'self'",
        "connect-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ],
    },
  },

  fonts: [
    {
      provider: fontProviders.local(),
      name: 'Bodoni Moda',
      cssVariable: '--font-editorial',
      fallbacks: ['Didot', 'Bodoni 72', 'serif'],
      options: {
        variants: [
          {
            weight: '400 900',
            style: 'normal',
            display: 'swap',
            src: ['./src/assets/fonts/bodoni-moda-latin-variable.woff2'],
          },
          {
            weight: '400 900',
            style: 'italic',
            display: 'swap',
            src: ['./src/assets/fonts/bodoni-moda-latin-italic-variable.woff2'],
          },
        ],
      },
    },
    {
      provider: fontProviders.local(),
      name: 'Archivo',
      cssVariable: '--font-grotesk',
      fallbacks: ['Helvetica Neue', 'Arial', 'sans-serif'],
      options: {
        variants: [
          {
            weight: '100 900',
            stretch: '62% 125%',
            style: 'normal',
            display: 'swap',
            src: ['./src/assets/fonts/archivo-latin-variable.woff2'],
          },
        ],
      },
    },
  ],

  image: {
    responsiveStyles: false,
  },

  // Las fichas de producto no necesitan resaltado de código; Shiki usa estilos
  // inline que la CSP bloquearía.
  markdown: {
    syntaxHighlight: false,
  },

  devToolbar: { enabled: false },

  vite: {
    define: {
      __KYRO_FIXTURES__: JSON.stringify(useFixtures),
      __KYRO_TEST_LOGO__: JSON.stringify(useTestLogo),
    },
  },
});
