import { describe, expect, it } from 'vitest';
import { DICTIONARIES } from './dictionaries';
import { LANGS } from './index';

describe('DICTIONARIES', () => {
  it('4 言語すべてに辞書がある', () => {
    for (const lang of LANGS) {
      expect(DICTIONARIES[lang].appName).toBe('Trip Wallet');
    }
  });

  it('曜日は 7 個ある', () => {
    for (const lang of LANGS) {
      expect(DICTIONARIES[lang].weekdays).toHaveLength(7);
    }
  });

  it('言語ごとに文言が違う', () => {
    expect(DICTIONARIES.ja.category.food).toBe('食事');
    expect(DICTIONARIES.en.category.food).toBe('Food');
    expect(DICTIONARIES.ko.category.food).toBe('식사');
    expect(DICTIONARIES.zh.category.food).toBe('餐饮');
  });

  it('人数は言語ごとの数え方になる', () => {
    expect(DICTIONARIES.ja.common.people(3)).toBe('3人');
    expect(DICTIONARIES.en.common.people(1)).toBe('1 person');
    expect(DICTIONARIES.en.common.people(3)).toBe('3 people');
  });

  it('日付書式は全言語にあり、英語だけ曜日が先頭に来る', () => {
    for (const lang of LANGS) {
      expect(typeof DICTIONARIES[lang].dateLabel).toBe('function');
    }
    expect(DICTIONARIES.ja.dateLabel(9, 12, '土')).toBe('9/12(土)');
    expect(DICTIONARIES.ko.dateLabel(9, 12, '토')).toBe('9/12(토)');
    expect(DICTIONARIES.zh.dateLabel(9, 12, '六')).toBe('9/12(六)');
    expect(DICTIONARIES.en.dateLabel(9, 12, 'Sat')).toBe('Sat, 9/12');
  });
});
