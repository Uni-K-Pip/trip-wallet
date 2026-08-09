// テスト環境で Blob / File を差し替えるためだけの宣言。
// @types/node をプロジェクト全体に入れないための最小定義。
// node:buffer が実際にエクスポートする Blob / File は、テスト(src/test/setup.ts)で
// 使う範囲では DOM の Blob / File と同じインターフェースとして扱って問題ないため、
// ここでは DOM 側の型(globalThis.Blob / globalThis.File)をそのまま再利用する。
// このファイルは node:buffer から import する 1 箇所(src/test/setup.ts)のためだけの
// ものであり、setTimeout の戻り値や process / Buffer / require などの Node 専用
// グローバルをプロジェクト全体に持ち込むものではない。
declare module 'node:buffer' {
  export const Blob: typeof globalThis.Blob;
  export const File: typeof globalThis.File;
}
