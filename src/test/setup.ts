import '@testing-library/jest-dom/vitest';
import { Blob as NodeBlob, File as NodeFile } from 'node:buffer';
// IndexedDB を jsdom に生やす。data 層のテストで使う。
import 'fake-indexeddb/auto';

// jsdom の Blob は Node の structuredClone で複製できず、IndexedDB へ保存した時点で
// 中身が失われる。実ブラウザでは起きない jsdom 固有の問題なので、テスト環境だけ
// Node 組み込みの Blob / File に差し替えて写真の保存と読み出しを検証できるようにする。
globalThis.Blob = NodeBlob;
globalThis.File = NodeFile;

// テストの既定言語を日本語に固定する。CI と手元で navigator.languages が違うと
// 画面の文言アサーションが環境依存になるため。
Object.defineProperty(navigator, 'languages', { value: ['ja-JP', 'ja'], configurable: true });

// jsdom には matchMedia が無い。テストの既定は「視差効果を減らす」= 有効にして、
// カウントアップなどの JS アニメーションを即座に最終値へ飛ばす。こうしないと
// 画面テストの金額アサーションがアニメーション途中の値を拾って不安定になる。
// アニメーションする側の挙動は useCountUp.test.ts がこのモックを上書きして検証する。
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  configurable: true,
  value: (query: string) => ({
    matches: query.includes('prefers-reduced-motion'),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }),
});
