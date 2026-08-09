import { describe, it, expect } from 'vitest';
import { computeTargetSize, MAX_EDGE } from './compressImage';

describe('computeTargetSize', () => {
  it('横長は幅を上限に合わせる', () => {
    expect(computeTargetSize(2000, 1500, 1280)).toEqual({ width: 1280, height: 960 });
  });

  it('縦長は高さを上限に合わせる', () => {
    expect(computeTargetSize(1500, 2000, 1280)).toEqual({ width: 960, height: 1280 });
  });

  it('上限以下の画像は拡大しない', () => {
    expect(computeTargetSize(800, 600, 1280)).toEqual({ width: 800, height: 600 });
  });

  it('ちょうど上限なら変えない', () => {
    expect(computeTargetSize(1280, 720, 1280)).toEqual({ width: 1280, height: 720 });
  });

  it('極端な縦横比でも 0 px にしない', () => {
    expect(computeTargetSize(4000, 3, 1280)).toEqual({ width: 1280, height: 1 });
  });

  it('既定の上限は 1280', () => {
    expect(MAX_EDGE).toBe(1280);
  });
});
