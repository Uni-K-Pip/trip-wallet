/** 長辺の上限。スマホのレシート写真はこれで十分読める。 */
export const MAX_EDGE = 1280;
export const JPEG_QUALITY = 0.7;

export function computeTargetSize(
  width: number,
  height: number,
  maxEdge: number,
): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxEdge) return { width, height };

  const scale = maxEdge / longest;
  return {
    // 極端な縦横比でも 0 px にならないようにする
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** カメラで撮った画像を縮小して JPEG にする。IndexedDB の容量を食い潰さないため。 */
export async function compressImage(
  file: Blob,
  maxEdge: number = MAX_EDGE,
  quality: number = JPEG_QUALITY,
): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  try {
    const { width, height } = computeTargetSize(bitmap.width, bitmap.height, maxEdge);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas の 2d コンテキストを取得できませんでした');
    ctx.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', quality);
    });
    if (!blob) throw new Error('JPEG への変換に失敗しました');
    return blob;
  } finally {
    bitmap.close();
  }
}
