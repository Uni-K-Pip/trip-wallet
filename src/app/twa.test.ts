import { describe, it, expect, beforeEach } from 'vitest';
import { isTwa, markTwaLaunch } from './twa';

function setReferrer(value: string): void {
  Object.defineProperty(document, 'referrer', { value, configurable: true });
}

describe('TWA 判定', () => {
  beforeEach(() => {
    localStorage.clear();
    setReferrer('');
  });

  it('referrer が無ければ TWA ではない', () => {
    markTwaLaunch();
    expect(isTwa()).toBe(false);
  });

  it('自分の Android アプリから起動されたら TWA と判定する', () => {
    setReferrer('android-app://io.github.unikpip.tripwallet');
    markTwaLaunch();
    expect(isTwa()).toBe(true);
  });

  it('末尾にスラッシュが付いた referrer でも TWA と判定する', () => {
    setReferrer('android-app://io.github.unikpip.tripwallet/');
    markTwaLaunch();
    expect(isTwa()).toBe(true);
  });

  it('他の Android アプリからのリンクは TWA と判定しない', () => {
    setReferrer('android-app://com.example.otherapp');
    markTwaLaunch();
    expect(isTwa()).toBe(false);
  });

  it('ブラウザからの通常訪問は TWA と判定しない', () => {
    setReferrer('https://www.google.com/');
    markTwaLaunch();
    expect(isTwa()).toBe(false);
  });

  it('一度判定したら referrer が失われても残る', () => {
    setReferrer('android-app://io.github.unikpip.tripwallet');
    markTwaLaunch();
    setReferrer('');
    markTwaLaunch();
    expect(isTwa()).toBe(true);
  });
});
