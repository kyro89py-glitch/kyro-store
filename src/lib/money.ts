import { store } from '../config/store';

const formatters = new Map<string, Intl.NumberFormat>();

function formatterFor(currency: string, locale: string): Intl.NumberFormat {
  const key = `${locale}:${currency}`;
  let formatter = formatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, { style: 'currency', currency });
    formatters.set(key, formatter);
  }
  return formatter;
}

/** Decimales que usa la moneda (2 para USD, 0 para PYG…). */
export function fractionDigits(currency: string, locale: string = store.locale): number {
  return formatterFor(currency, locale).resolvedOptions().maximumFractionDigits ?? 2;
}

/**
 * Los importes se guardan siempre como enteros en la unidad mínima de la moneda
 * para no acumular errores de coma flotante al sumar.
 */
export function formatPrice(amountMinor: number, currency: string, locale: string = store.locale): string {
  if (!Number.isSafeInteger(amountMinor)) {
    throw new TypeError(`Importe no válido: ${amountMinor}`);
  }
  const divisor = 10 ** fractionDigits(currency, locale);
  return formatterFor(currency, locale).format(amountMinor / divisor);
}

/** Importe decimal en texto, como lo piden schema.org y las pasarelas ("1250.00"). */
export function toDecimalString(amountMinor: number, currency: string): string {
  const digits = fractionDigits(currency);
  return (amountMinor / 10 ** digits).toFixed(digits);
}
