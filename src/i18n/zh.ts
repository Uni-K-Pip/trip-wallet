import type { Dictionary } from './dictionaries';

export const zh: Dictionary = {
  appName: 'Trip Wallet',
  weekdays: ['日', '一', '二', '三', '四', '五', '六'],
  common: {
    loading: '加载中…',
    cancel: '取消',
    save: '保存',
    add: '添加',
    edit: '编辑',
    delete: '删除',
    close: '关闭',
    confirm: '确定',
    unset: '未设置',
    deleteDigit: '删除一个字符',
    people: (n) => `${n}人`,
    items: (n) => `${n}笔`,
  },
  category: {
    food: '餐饮',
    transport: '交通',
    sightseeing: '观光',
    shopping: '购物',
    lodging: '住宿',
    other: '其他',
  },
  payment: { cash: '现金', mobile: '扫码支付', card: '刷卡' },
  scope: { personal: '个人', shared: '共同' },
  error: { title: '发生错误', reload: '重新加载' },
};
