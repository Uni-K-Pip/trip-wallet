export type NumpadKey = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '.' | 'del';

const MAX_INT_DIGITS = 9;

/** テンキーの 1 打鍵を金額文字列に適用する。数字文字列だけを扱い、丸めや換算はしない。 */
export function pressKey(value: string, key: NumpadKey, decimals: number): string {
  if (key === 'del') return value.slice(0, -1);

  if (key === '.') {
    if (decimals === 0 || value.includes('.')) return value;
    return value === '' ? '0.' : `${value}.`;
  }

  const [intPart, decPart] = value.split('.');
  if (decPart === undefined) {
    if (value === '0') return key;
    if (intPart.length >= MAX_INT_DIGITS) return value;
    return value + key;
  }

  if (decPart.length >= decimals) return value;
  return value + key;
}

const KEYS: NumpadKey[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'del'];

type Props = {
  value: string;
  decimals: number;
  onChange: (next: string) => void;
};

export function Numpad({ value, decimals, onChange }: Props) {
  return (
    <div className="numpad">
      {KEYS.map((key) => (
        <button
          key={key}
          type="button"
          className="numpad-key"
          aria-label={key === 'del' ? '1 文字削除' : key}
          disabled={key === '.' && decimals === 0}
          onClick={() => onChange(pressKey(value, key, decimals))}
        >
          {key === 'del' ? '⌫' : key}
        </button>
      ))}
    </div>
  );
}
