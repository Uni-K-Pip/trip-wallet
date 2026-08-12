export type Lang = 'ja' | 'en' | 'ko' | 'zh';

/** 設定画面に並べる順。 */
export const LANGS: readonly Lang[] = ['ja', 'en', 'ko', 'zh'];

/** 言語名はその言語自身の表記で固定する(読めない言語に迷い込まないため)。だから辞書には入れない。 */
export const LANG_LABELS: Record<Lang, string> = {
  ja: '日本語',
  en: 'English',
  ko: '한국어',
  zh: '中文',
};

const SUPPORTED: readonly string[] = LANGS;

/**
 * 端末の言語設定から対応言語を選ぶ。
 * zh-Hant / zh-TW のような下位タグは見ず、先頭 2 文字だけで判定する。
 */
export function detectLang(tags: readonly string[] = navigator.languages ?? []): Lang {
  for (const tag of tags) {
    const head = tag.slice(0, 2).toLowerCase();
    if (SUPPORTED.includes(head)) return head as Lang;
  }
  return 'en';
}

/** 言語ごとの換算先通貨の既定値。設定でも旅行ごとでも上書きできる。 */
export function defaultHomeCurrency(lang: Lang): string {
  return { ja: 'JPY', en: 'USD', ko: 'KRW', zh: 'CNY' }[lang];
}
