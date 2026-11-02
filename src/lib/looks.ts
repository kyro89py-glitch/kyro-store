import { getCollection, type CollectionEntry } from 'astro:content';
import { store } from '../config/store';

export type Look = CollectionEntry<'looks'>;

/** Looks en su orden (menor `order` primero). */
export async function getLooks(): Promise<Look[]> {
  const looks = await getCollection('looks');
  return looks.sort((a, b) => a.data.order - b.data.order || a.data.title.localeCompare(b.data.title, store.locale));
}
