/**
 * Ko-fi の寄付ページ。差し替えるのはこの 1 行だけ。
 * 空文字に戻すとサポートセクションを描画しない。型は string に固定しておく(リテラル型に潰れると差し替え時に比較が壊れる)。
 */
export const DONATION_URL: string = 'https://ko-fi.com/unikpip';

/** サポートセクションを描画してよいか。 */
export function shouldShowDonation(url: string = DONATION_URL): boolean {
  return url !== '';
}
