export interface ArticleItem {
  id: string;
  no: string;
  category: string;
  minutes: number;
  title: string;
  description: string;
  paragraphs: string[];
  slug?: string;
}

export const ARTICLES: ArticleItem[] = [
  {
    id: 'a1',
    no: '01',
    category: '设计笔记',
    title: '一条线能说多少话',
    description: '线的粗细、断口和收尾，本身就是语气。',
    minutes: 2,
    paragraphs: [
      '简笔画的魅力在于省略：画一个人，只需要一个圆和五条线。但省略不等于随便，每一条留下来的线都要承担更多意思。',
      '同样一条横线，收尾轻轻上挑是微笑，平平收住是专注，略微下垂就成了犹豫。线越少，这些细小的差别就越显眼。',
      '所以做线稿界面时，与其加更多元素，不如把仅有的几条线画得更准：统一的线宽、圆润的端点、恰当的间距。',
    ],
    slug: 'lines-and-voice',
  },
  {
    id: 'a2',
    no: '02',
    category: '互动实验',
    title: '给首页留一个能玩的角落',
    description: '一个十秒就能上手的小游戏，比一段自我介绍更快让人记住。',
    minutes: 2,
    paragraphs: [
      '个人站点的首页常常只有标题和列表。加入一个小小的互动，访客的停留就从“看”变成了“玩”。',
      '关键是克制：规则一句话说完，键盘和手指都能操作，不玩的时候它安静地待着，不抢页面的注意力。',
      '上面的“贪吃蛇”就是这样一个实验：吃到点，别咬到自己。',
    ],
    slug: 'playable-corner',
  },
  {
    id: 'a3',
    no: '03',
    category: '排版随记',
    title: '留白是一种节奏',
    description: '空白不是没有内容，而是让内容有了呼吸的间隔。',
    minutes: 1,
    paragraphs: [
      '读一页文字，眼睛需要落脚点。段落之间、章节之间的空白，就像音乐里的休止符。',
      '把间距设成有规律的几档——小、中、大——页面自然会形成节奏，读者也更容易分辨什么属于一组。',
    ],
    slug: 'white-space-rhythm',
  },
  {
    id: 'a4',
    no: '04',
    category: '设计笔记',
    title: '按钮的手感来自哪里',
    description: '边角、线宽和按下的位移，比颜色更能让人觉得「能点」。',
    minutes: 2,
    paragraphs: [
      '很多人先给按钮涂颜色。其实访客最先感觉到的，是轮廓是否清晰、按下时有没有一点点反馈。',
      '手绘风格里，略微不规则的圆角、略粗的描边，会让控件看起来可触碰；再加一像素的下沉，就有了手感。',
      '颜色可以后补；先把「像按钮」这件事做对，页面才站得住。',
    ],
    slug: 'button-tactile',
  },
  {
    id: 'a5',
    no: '05',
    category: '互动实验',
    title: '展开阅读不必离开页面',
    description: '短文就地展开，列表和正文共用同一张纸面。',
    minutes: 2,
    paragraphs: [
      '博客常见的路径是：列表 → 新页面 → 再回来。短文其实不必走这一圈。',
      '在同一页展开，读者的视线不用重新找位置，上下文还在；收起后列表也还在原处。',
      '适合笔记和随记；长文再考虑单独成页。',
    ],
    slug: 'inline-reading',
  },
  {
    id: 'a6',
    no: '06',
    category: '排版随记',
    title: '编号是版式的节拍器',
    description: '01、02、03 不只是序号，也在告诉眼睛「这里换了一章」。',
    minutes: 1,
    paragraphs: [
      '等宽数字放在标题左侧，版面立刻有了杂志感。读者扫一眼就能知道章节边界。',
      '编号要克制：字号略大、颜色略淡，不要抢过标题本身。',
    ],
    slug: 'number-rhythm',
  },
];
