import { routes } from '../lib/urls';
import { store } from './store';

/**
 * Preguntas frecuentes de /ayuda/.
 *
 * Cada respuesta describe un comportamiento del sitio que se puede comprobar (y que
 * comprueban las pruebas e2e): nada sobre envíos, plazos, cambios ni devoluciones,
 * que solo puede definir KYRO. Si cambia lo que describe una respuesta (se activa el
 * pago, llegan las cuentas de cliente, se añade analítica…), hay que revisarla.
 */
export interface HelpLink {
  label: string;
  href: string;
}

export interface HelpTopic {
  /** Ancla de la pregunta: /ayuda/#<id> la abre. */
  id: string;
  question: string;
  answer: string[];
  links?: HelpLink[];
}

/** Nombre de /ayuda/ en la página, el pie y el menú: "contacto" solo si hay a dónde escribir. */
export const helpTitle = store.contact.email ? 'Ayuda y contacto' : 'Ayuda';

interface HelpContext {
  /** Páginas informativas publicadas (términos, envíos…), si las hay. */
  infoPages: HelpLink[];
}

export function getHelpTopics({ infoPages }: HelpContext): HelpTopic[] {
  const max = store.cart.maxQuantityPerLine;
  // "Escríbenos" solo tiene sentido si KYRO publicó un correo.
  const write = store.contact.email ? ['Para cualquier otra consulta, escríbenos.'] : [];
  const topics: HelpTopic[] = [];

  if (!store.checkout.enabled) {
    topics.push({
      id: 'comprar',
      question: '¿Puedo comprar en línea?',
      answer: [
        'Todavía no. El pago en línea no está activo: el sitio no recibe pedidos ni cobra ningún importe.',
        'Puedes preparar tu selección en el carrito; se conserva en este dispositivo.',
        ...write,
      ],
      links: [{ label: 'Ver el carrito', href: routes.cart() }],
    });
  }

  topics.push(
    {
      id: 'carrito',
      question: '¿Dónde se guarda mi carrito?',
      answer: [
        'En este navegador, en este dispositivo. No se envía a ningún servidor y no pasa de un dispositivo a otro.',
        'Si borras los datos del sitio o abres la tienda en otro navegador, el carrito empieza vacío.',
      ],
    },
    {
      id: 'cuenta',
      question: '¿Necesito una cuenta?',
      answer: [
        'No. Por ahora el sitio no tiene cuentas de cliente y no pide ningún dato personal para ver la tienda ni para usar el carrito.',
      ],
    },
    {
      id: 'disponibilidad',
      question: '¿Por qué no puedo elegir una talla?',
      answer: [
        'Las tallas sin existencias aparecen tachadas y no se pueden añadir al carrito.',
        'Si una pieza que ya estaba en tu carrito deja de estar disponible, se indica en el carrito y no se suma al subtotal.',
      ],
    },
    {
      id: 'cantidad',
      question: '¿Cuántas unidades puedo añadir?',
      answer: [`Hasta ${max} unidades de cada talla. Las cantidades se cambian desde el carrito.`],
      links: [{ label: 'Ver el carrito', href: routes.cart() }],
    },
    {
      id: 'condiciones',
      question: '¿Dónde consulto envíos, cambios y devoluciones?',
      answer: [
        infoPages.length > 0
          ? 'La información que KYRO ha publicado está en estas páginas.'
          : 'Las condiciones de envío, cambios y devoluciones todavía no están publicadas en este sitio.',
        ...write,
      ],
      links: infoPages,
    },
    {
      id: 'datos',
      question: '¿Qué guarda el sitio en mi navegador?',
      answer: [
        'Solo el contenido del carrito (qué piezas, tallas y cantidades), para que no se pierda al cambiar de página.',
        'El sitio no usa cookies ni herramientas de análisis o publicidad.',
      ],
    },
  );

  return topics;
}
