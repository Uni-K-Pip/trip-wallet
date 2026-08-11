export type Scope = 'personal' | 'shared';
export type Category =
  | 'food'
  | 'transport'
  | 'sightseeing'
  | 'shopping'
  | 'lodging'
  | 'other';
export type Payment = 'cash' | 'mobile' | 'card';
/** same は現地通貨と換算先通貨が同じでレートが 1 の場合 */
export type RateSource = 'api' | 'cache' | 'manual' | 'same';

export type Trip = {
  id: string;
  name: string;
  /** 現地通貨。ISO 4217。"CNY" など */
  currency: string;
  /** 現地通貨の最小単位の桁数。旅行を作った時点の値を保存する */
  currencyDecimals: number;
  /** 換算先通貨。ISO 4217。"JPY" など */
  homeCurrency: string;
  /** 換算先通貨の最小単位の桁数 */
  homeCurrencyDecimals: number;
  startDate: string;
  endDate: string | null;
  /** 個別支出の予算(換算先通貨の最小単位)。未設定は null */
  personalBudgetHome: number | null;
  /** 共有支出のうち自分の負担分の予算(換算先通貨の最小単位)。未設定は null */
  sharedBudgetHome: number | null;
  memberCount: number;
  createdAt: number;
};

export type Expense = {
  id: string;
  tripId: string;
  /** 現地日付 "2026-09-12" */
  date: string;
  /** 外貨の最小単位(元 → 分)。浮動小数にしない */
  amountMinor: number;
  scope: Scope;
  category: Category;
  payment: Payment;
  memo: string;
  /** 記録時点の「1 外貨 = ? 円」。以後再計算しない */
  rate: number;
  rateSource: RateSource;
  photoId: string | null;
  createdAt: number;
  updatedAt: number;
};

export type Photo = {
  id: string;
  /** 圧縮済み JPEG */
  blob: Blob;
};

export type RateCache = {
  /** "CNY:JPY:2026-09-12" */
  key: string;
  base: string;
  /** 換算先通貨 */
  quote: string;
  date: string;
  rate: number;
  /** API が実際に返した日付。土日祝は直近営業日になる */
  effectiveDate: string;
  fetchedAt: number;
  source: 'frankfurter' | 'er-api';
};
