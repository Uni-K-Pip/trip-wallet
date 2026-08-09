import '@testing-library/jest-dom/vitest';
import { Blob as NodeBlob, File as NodeFile } from 'node:buffer';
// IndexedDB を jsdom に生やす。data 層のテストで使う。
import 'fake-indexeddb/auto';

// jsdom の Blob は Node の structuredClone で複製できず、IndexedDB へ保存した時点で
// 中身が失われる。実ブラウザでは起きない jsdom 固有の問題なので、テスト環境だけ
// Node 組み込みの Blob / File に差し替えて写真の保存と読み出しを検証できるようにする。
globalThis.Blob = NodeBlob as unknown as typeof globalThis.Blob;
globalThis.File = NodeFile as unknown as typeof globalThis.File;
