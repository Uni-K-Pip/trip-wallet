export type Scope = 'personal' | 'shared';
export type Category =
  | 'food'
  | 'transport'
  | 'sightseeing'
  | 'shopping'
  | 'lodging'
  | 'other';
export type Payment = 'cash' | 'mobile' | 'card';
export type RateSource = 'api' | 'cache' | 'manual';

export type Trip = {
  id: string;
  name: string;
  /** ISO 4217。"CNY" など */
  currency: string;
  /** 最小単位の桁数。CNY は 2、KRW は 0 */
  currencyDecimals: number;
  /** "2026-09-12" */
  startDate: string;
  endDate: string | null;
  /** 予算(円)。未設定は null */
  budgetJpy: number | null;
  /** 共有支出を割る人数。既定 1 */
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
  date: string;
  rate: number;
  /** API が実際に返した日付。土日祝は直近営業日になる */
  effectiveDate: string;
  fetchedAt: number;
  source: 'frankfurter' | 'er-api';
};
