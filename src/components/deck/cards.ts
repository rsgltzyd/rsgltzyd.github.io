export interface DeckCoverCard {
  kind: 'cover';
  tag: string;
  title: string;
  deck: string;
  hint: string;
}

export interface DeckGlobeCard {
  kind: 'globe';
  tag: string;
  title: string;
  deck: string;
  seasons: readonly string[];
  ctaLabel: string;
  ctaHref: string;
}

export interface DeckNoteCard {
  kind: 'note';
  tag: string;
  title: string;
  quote: string;
  paragraphs: readonly string[];
}

export interface DeckQuoteCard {
  kind: 'quote';
  tag: string;
  quote: string;
  caption: string;
}

export interface DeckAboutCard {
  kind: 'about';
  tag: string;
  title: string;
  deck: string;
  ctaLabel: string;
  ctaHref: string;
}

export type DeckCard =
  | DeckCoverCard
  | DeckGlobeCard
  | DeckNoteCard
  | DeckQuoteCard
  | DeckAboutCard;

export const DECK_CARDS: readonly DeckCard[] = [
  {
    kind: 'cover',
    tag: 'VOL. 01 · 卷首',
    title: '用最少的线条，留住四季与光阴',
    deck: '书桌上的一叠剪报与手记——左右拨动纸片，翻看这一期收进来的几件小事。',
    hint: '按住左右拨动切卡',
  },
  {
    kind: 'globe',
    tag: '空间实验 · 3D',
    title: '把四季装进一颗玻璃球',
    deck: '春樱、夏萤、秋枫与冬雪，各自住在同一方小小天地里。拖拽 360° 端详，摇一摇让细雪与落叶再次扬起。',
    seasons: ['春樱', '夏萤', '秋枫', '冬雪'],
    ctaLabel: '进入四季玻璃球 →',
    ctaHref: '/globe',
  },
  {
    kind: 'about',
    tag: '关于小站',
    title: '雨霖铃',
    deck: '喜欢用克制的线条、会随昼夜晴雨流转的纸色，把小物件做得耐看又好玩。',
    ctaLabel: '查看完整关于 →',
    ctaHref: '/#about',
  },
];
