import { getCollection, type CollectionEntry } from 'astro:content';
import { store } from '../config/store';

export type InfoPage = CollectionEntry<'pages'>;

/** Páginas informativas en el orden del pie de página. */
export async function getInfoPages(): Promise<InfoPage[]> {
  const pages = await getCollection('pages');
  return pages.sort(
    (a, b) => a.data.order - b.data.order || a.data.title.localeCompare(b.data.title, store.locale),
  );
}
