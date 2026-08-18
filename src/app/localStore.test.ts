import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readLocal, writeLocal } from './localStore';

describe('localStorage の読み書き', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('書いた値をそのまま読み戻せる', () => {
    writeLocal('k', 'v');
    expect(readLocal('k')).toBe('v');
  });

  it('保存されていないキーは null', () => {
    expect(readLocal('k')).toBeNull();
  });

  it('読み取りが例外を投げても null を返す', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(readLocal('k')).toBeNull();
  });

  it('保存が例外を投げても呼び出し側には伝わらない', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(() => writeLocal('k', 'v')).not.toThrow();
  });
});
