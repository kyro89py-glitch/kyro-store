# Fase 2: pagos y pedidos reales

Nada de esto está implementado. El carrito actual funciona en el navegador y el botón
"Pagar" está desactivado (`store.checkout.enabled = false`).

## Hosting

GitHub Pages no sirve: es solo estático y sus condiciones no permiten tiendas online.
Opciones con funciones de servidor y adaptador oficial de Astro:

| Servicio | Adaptador | Nota |
| --- | --- | --- |
| Vercel | `@astrojs/vercel` | Despliegue desde GitHub; variables de entorno cifradas. |
| Netlify | `@astrojs/netlify` | Equivalente; funciones y formularios. |
| Cloudflare | `@astrojs/cloudflare` | Red global; Workers en el borde. |
| Servidor propio | `@astrojs/node` | Más control, más mantenimiento. |

Las páginas de catálogo siguen siendo estáticas (`prerender`); solo las rutas de pago y
pedidos se ejecutan en el servidor. En ese hosting sí se pueden configurar cabeceras HTTP
(CSP, HSTS, `frame-ancestors`).

## Flujo de compra

```
Carrito (navegador)
  │  POST /api/checkout  { lines: [{ sku, quantity }] }   ← nada de precios
  ▼
Servidor
  1. Valida SKU y cantidades contra el catálogo y el inventario en la base de datos.
  2. Recalcula precios y totales (envío e impuestos cuando estén definidos).
  3. Crea el pedido en estado "pendiente".
  4. Crea la sesión de pago en la pasarela y devuelve su URL.
  │
  ▼
Página de pago alojada por la pasarela (los datos de tarjeta nunca pasan por KYRO)
  │
  ├──▶ Webhook POST /api/webhooks/pagos
  │      - verifica la firma de la pasarela
  │      - ignora eventos repetidos (idempotencia por ID de evento)
  │      - marca el pedido "pagado" y descuenta existencias en una transacción
  │      - envía el correo de confirmación
  │
  └──▶ Redirección a /pedido/confirmado/?id=…
         - consulta el estado del pedido en el servidor (nunca confía en la URL)
```

## Datos

Base de datos Postgres gestionada (por ejemplo Neon o Supabase):

- `products` / `variants`: SKU, precio vigente, existencias.
- `orders`: estado (`pendiente`, `pagado`, `enviado`, `cancelado`, `reembolsado`),
  totales, moneda, datos de envío, referencia de la pasarela.
- `order_items`: SKU, nombre y precio **copiados** en el momento de la compra.
- `payment_events`: ID y tipo de cada webhook recibido (idempotencia y auditoría).

El catálogo editorial (fotos, textos) puede seguir en el repositorio; precio y existencias
pasan a la base de datos como fuente de verdad, y `/catalog.json` se genera desde ella.

## Pasarela de pago

Depende del país donde KYRO factura y cobra:

- **Paraguay:** según fuentes no oficiales consultadas, Stripe no admite comercios con
  sede en Paraguay (no se pudo confirmar en la web de Stripe). Opciones locales a evaluar:
  Bancard (vPOS / Checkout) y Pagopar.
- **Otros países de Latinoamérica:** Mercado Pago; Stripe donde esté disponible.
- **Internacional:** Stripe Checkout o PayPal.

Criterios: página de pago alojada (alcance PCI mínimo), webhooks firmados, comisiones,
plazos de liquidación, monedas, reembolsos y medios locales (tarjetas, transferencias, QR).

## Seguridad

- Claves de la pasarela y de la base de datos **solo** en variables de entorno del hosting.
- El servidor nunca acepta precios ni totales del navegador.
- Firma verificada en cada webhook; respuesta rápida y procesamiento idempotente.
- Límite de peticiones en `/api/checkout`; validación estricta del cuerpo (Zod).
- Correos y datos personales: mínimos necesarios, política de privacidad publicada.

## Decisiones que necesita KYRO antes de empezar

1. País de facturación y pasarela de pago.
2. Moneda(s) de venta.
3. Zonas, tarifas y plazos de envío.
4. Impuestos aplicables y facturación electrónica, si corresponde.
5. Política de cambios y devoluciones.
6. Textos legales: términos, privacidad, cookies.
7. Servicio de hosting y dominio.
