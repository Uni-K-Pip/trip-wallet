/**
 * jsdom には matchMedia が無いので、テスト用の最小スタブを window に生やす。
 * reduced が true なら prefers-reduced-motion のクエリだけが matches になる。
 */
export function stubMatchMedia(reduced: boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: reduced && query.includes('prefers-reduced-motion'),
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}
