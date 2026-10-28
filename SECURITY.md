# Seguridad

## Informar de una vulnerabilidad

No abras una incidencia pública. Usa el aviso privado de vulnerabilidades de GitHub
(pestaña *Security* → *Report a vulnerability*) para que solo el equipo de KYRO lo vea.

## Prácticas del proyecto

- Ningún secreto en el repositorio. Las claves irán solo en las variables de entorno del
  hosting (ver `.env.example`).
- Content-Security-Policy estricta en todas las páginas; sin scripts de terceros.
- El navegador nunca decide precios: el carrito guarda SKU y cantidad, y los importes
  salen del catálogo (en la fase 2, del servidor).
- Dependencias con versión exacta, `npm ci` en la CI y actualizaciones con Dependabot.
- Acciones de GitHub fijadas por commit y con permisos de solo lectura.
