# Catálogo de prueba

**Estos productos no son reales.** Solo existen para probar las páginas de catálogo,
producto y carrito (`npm run dev:fixtures`, `npm run build:fixtures`, `npm run test:e2e`).

- La moneda es `XTS`, el código ISO 4217 reservado para pruebas.
- Las imágenes son abstractas y se generan con `node tests/fixtures/generate-images.mjs`.
- Nunca se compilan en `dist/`: el build de prueba va a `.fixtures-dist/` y muestra un
  aviso visible de "Catálogo de prueba".
