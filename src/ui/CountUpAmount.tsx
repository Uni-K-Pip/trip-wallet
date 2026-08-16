import { formatWithCurrency } from '../domain/money';
import { useCountUp } from './useCountUp';

/**
 * 合計金額を 0 から数え上げて表示する。
 * useCountUp はフックなので、画面コンポーネントの早期 return より後ろでは呼べない。
 * 表示だけを切り出してフックの呼び出し位置を安全にしている。
 */
export function CountUpAmount({
  value,
  currency,
  testId,
}: {
  value: number;
  currency: string;
  testId: string;
}) {
  const shown = useCountUp(value);
  return (
    <span className="card-home" data-testid={testId}>
      {formatWithCurrency(shown, currency)}
    </span>
  );
}
