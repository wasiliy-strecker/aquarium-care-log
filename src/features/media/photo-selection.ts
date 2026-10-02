import type { Attachment } from '../../core/domain/models';

export function mergePhotos(
  current: Attachment[],
  added: Attachment[],
  replaceId?: string,
): Attachment[] {
  if (!added.length) return current;
  if (replaceId) {
    if (!current.some((photo) => photo.id === replaceId))
      throw new Error('Das zu ersetzende Foto wurde nicht gefunden.');
    return current.map((photo) => (photo.id === replaceId ? added[0]! : photo));
  }
  if (current.length + added.length > 200)
    throw new Error('Ein Pflegeeintrag kann höchstens 200 Fotos enthalten.');
  return [...current, ...added];
}
