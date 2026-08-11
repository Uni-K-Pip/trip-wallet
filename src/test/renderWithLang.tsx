import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { LangProvider } from '../i18n/LangContext';
import type { Lang } from '../i18n';

/** 画面テストは LangProvider の中で描画する。既定は日本語(既存テストの期待文字列に合わせる)。 */
export function renderWithLang(ui: ReactElement, lang: Lang = 'ja') {
  return render(ui, {
    wrapper: ({ children }) => <LangProvider initial={lang}>{children}</LangProvider>,
  });
}
