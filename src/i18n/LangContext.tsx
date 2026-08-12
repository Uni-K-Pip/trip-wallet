import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { loadLang, saveLang } from '../app/settings';
import { DICTIONARIES } from './dictionaries';
import type { Dictionary } from './dictionaries';
import { detectLang } from './index';
import type { Lang } from './index';

type LangValue = { lang: Lang; t: Dictionary; setLang: (lang: Lang) => void };

const LangCtx = createContext<LangValue | null>(null);

/** initial はテスト用。実行時は 保存値 → 端末の言語 の順で決める。 */
export function LangProvider({ children, initial }: { children: ReactNode; initial?: Lang }) {
  const [lang, setLangState] = useState<Lang>(() => initial ?? loadLang() ?? detectLang());

  // <html lang> はスクリーンリーダーの読み上げ言語に効くので追随させる
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = (next: Lang) => {
    saveLang(next);
    setLangState(next);
  };

  return <LangCtx.Provider value={{ lang, t: DICTIONARIES[lang], setLang }}>{children}</LangCtx.Provider>;
}

export function useI18n(): LangValue {
  const value = useContext(LangCtx);
  if (value === null) throw new Error('useI18n は LangProvider の中で使ってください');
  return value;
}
