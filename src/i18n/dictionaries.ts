import { en } from './en';
import { ja } from './ja';
import { ko } from './ko';
import { zh } from './zh';
import type { Lang } from './index';

/** 辞書の型は日本語版から作る。他の 3 言語は形が違うと tsc が落ちる。 */
export type Dictionary = typeof ja;

export const DICTIONARIES: Record<Lang, Dictionary> = { ja, en, ko, zh };
