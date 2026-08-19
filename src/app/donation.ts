/**
 * Ko-fi の寄付ページ。アカウント作成後にここだけ書き換える。
 * 空文字のあいだはサポートセクションを描画しない。型は string に固定しておく(リテラル型に潰れると差し替え時に比較が壊れる)。
 */
export const DONATION_URL: string = '';

/** サポートセクションを描画してよいか。 */
export function shouldShowDonation(url: string = DONATION_URL): boolean {
  return url !== '';
}
