import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LangProvider, useI18n } from './LangContext';

/** 辞書を引くだけの確認用コンポーネント。切り替えボタンも自前で持つ。 */
function Probe() {
  const { t, setLang } = useI18n();
  return (
    <div>
      <span data-testid="label">{t.category.food}</span>
      <button type="button" onClick={() => setLang('en')}>
        en
      </button>
    </div>
  );
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.lang = '';
});

describe('LangProvider', () => {
  it('言語を切り替えると文言が変わり localStorage に残る', async () => {
    const user = userEvent.setup();
    render(
      <LangProvider initial="ja">
        <Probe />
      </LangProvider>,
    );

    expect(screen.getByTestId('label')).toHaveTextContent('食事');

    await user.click(screen.getByRole('button', { name: 'en' }));

    expect(screen.getByTestId('label')).toHaveTextContent('Food');
    expect(localStorage.getItem('trip-wallet:lang')).toBe('en');
  });

  it('document.documentElement.lang を追随させる', async () => {
    const user = userEvent.setup();
    render(
      <LangProvider initial="ja">
        <Probe />
      </LangProvider>,
    );

    expect(document.documentElement.lang).toBe('ja');

    await user.click(screen.getByRole('button', { name: 'en' }));

    expect(document.documentElement.lang).toBe('en');
  });

  it('保存値があればそれを使う', () => {
    localStorage.setItem('trip-wallet:lang', 'ko');
    render(
      <LangProvider>
        <Probe />
      </LangProvider>,
    );

    expect(screen.getByTestId('label')).toHaveTextContent('식사');
  });

  it('LangProvider の外で useI18n を呼ぶと落ちる', () => {
    // render が投げたエラーを React がコンソールに出すので黙らせる
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow('useI18n は LangProvider の中で使ってください');
    spy.mockRestore();
  });
});
