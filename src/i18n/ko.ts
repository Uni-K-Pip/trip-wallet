import type { Dictionary } from './dictionaries';

export const ko: Dictionary = {
  appName: 'Trip Wallet',
  weekdays: ['일', '월', '화', '수', '목', '금', '토'],
  common: {
    loading: '불러오는 중…',
    cancel: '취소',
    save: '저장',
    add: '추가',
    edit: '편집',
    delete: '삭제',
    close: '닫기',
    confirm: '확인',
    unset: '미설정',
    deleteDigit: '한 글자 삭제',
    people: (n) => `${n}명`,
    items: (n) => `${n}건`,
  },
  category: {
    food: '식사',
    transport: '교통',
    sightseeing: '관광',
    shopping: '쇼핑',
    lodging: '숙박',
    other: '기타',
  },
  payment: { cash: '현금', mobile: 'QR결제', card: '카드' },
  scope: { personal: '개별', shared: '공유' },
  error: { title: '오류가 발생했습니다', reload: '새로 고침' },
};
