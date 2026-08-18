// プライベートブラウジングや容量超過で localStorage は例外を投げる。
// 設定が読み書きできなくても起動と操作は止めない。
export function readLocal(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeLocal(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // 保存できなくても今回の操作は続行する
  }
}
