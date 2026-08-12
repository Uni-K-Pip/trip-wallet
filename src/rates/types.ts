export type FetchedRate = {
  rate: number;
  /** API が実際に返した日付。土日祝は直近営業日になる */
  effectiveDate: string;
};
