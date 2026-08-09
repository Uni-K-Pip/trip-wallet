import { db, newId } from './db';

export async function savePhoto(blob: Blob): Promise<string> {
  const id = newId();
  await db.photos.add({ id, blob });
  return id;
}

export async function getPhoto(id: string): Promise<Blob | undefined> {
  return (await db.photos.get(id))?.blob;
}

export async function deletePhoto(id: string): Promise<void> {
  await db.photos.delete(id);
}
