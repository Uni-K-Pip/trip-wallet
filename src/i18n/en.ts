import type { Dictionary } from './dictionaries';

export const en: Dictionary = {
  appName: 'Trip Wallet',
  weekdays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  common: {
    loading: 'Loading…',
    cancel: 'Cancel',
    save: 'Save',
    add: 'Add',
    edit: 'Edit',
    delete: 'Delete',
    close: 'Close',
    confirm: 'OK',
    unset: 'Not set',
    deleteDigit: 'Delete one character',
    people: (n) => `${n} ${n === 1 ? 'person' : 'people'}`,
    items: (n) => `${n} ${n === 1 ? 'item' : 'items'}`,
  },
  category: {
    food: 'Food',
    transport: 'Transit',
    sightseeing: 'Sights',
    shopping: 'Shopping',
    lodging: 'Lodging',
    other: 'Other',
  },
  payment: { cash: 'Cash', mobile: 'Mobile pay', card: 'Card' },
  scope: { personal: 'Personal', shared: 'Shared' },
  error: { title: 'Something went wrong', reload: 'Reload' },
};
