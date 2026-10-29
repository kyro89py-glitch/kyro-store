// Revela los elementos [data-reveal] cuando entran en pantalla (estilos en base.css).
// Las piezas que entran a la vez se escalonan en orden de lectura.

declare global {
  interface Window {
    __kyroMotion?: boolean;
  }
}

const MAX_ORDER = 6;

function byReadingOrder(a: Element, b: Element): number {
  const ra = a.getBoundingClientRect();
  const rb = b.getBoundingClientRect();
  return ra.top - rb.top || ra.left - rb.left;
}

function revealAll(elements: Iterable<Element>) {
  for (const element of elements) element.classList.add('is-revealed');
}

const targets = document.querySelectorAll('[data-reveal]');

if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      const entering = entries
        .filter((entry) => entry.isIntersecting)
        .map((entry) => entry.target)
        .sort(byReadingOrder);
      entering.forEach((element, index) => {
        // CSSOM (no atributo style en el HTML): compatible con la CSP del sitio.
        (element as HTMLElement).style.setProperty('--reveal-order', String(Math.min(index, MAX_ORDER)));
        element.classList.add('is-revealed');
        observer.unobserve(element);
      });
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0 },
  );
  for (const target of targets) observer.observe(target);
} else {
  revealAll(targets);
}

// Señal para el seguro del <head>: si este script no llegara a ejecutarse, se
// retira html.motion y todo queda visible.
window.__kyroMotion = true;

export {};
