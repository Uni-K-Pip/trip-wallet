import type { Category, Payment, Scope } from '../domain/types';

// 辞書の型はこのファイルから作る(Dictionary = typeof ja)。as const は付けないこと。
export const ja = {
  appName: 'Trip Wallet',
  weekdays: ['日', '月', '火', '水', '木', '金', '土'],
  common: {
    loading: '読み込み中…',
    cancel: 'キャンセル',
    save: '保存',
    add: '追加',
    edit: '編集',
    delete: '削除',
    close: '閉じる',
    confirm: '決定',
    unset: '未設定',
    deleteDigit: '1 文字削除',
    people: (n: number) => `${n}人`,
    items: (n: number) => `${n}件`,
  },
  category: {
    food: '食事',
    transport: '交通',
    sightseeing: '観光',
    shopping: '買物',
    lodging: '宿泊',
    other: 'その他',
  } satisfies Record<Category, string>,
  payment: {
    cash: '現金',
    mobile: 'QR決済',
    card: 'カード',
  } satisfies Record<Payment, string>,
  scope: {
    personal: '個別',
    shared: '共有',
  } satisfies Record<Scope, string>,
  error: {
    title: 'エラーが発生しました',
    reload: '再読み込み',
  },
};
