#!/usr/bin/env node

/**
 * Visual verification against the grok.bot homepage design draft:
 * https://pale-badger-o2qdvq.pages.grok.bot/
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const DIST_INDEX = path.join(ROOT, 'dist', 'index.html');
const DIST_POSTS = path.join(ROOT, 'dist', 'posts', 'index.html');

console.log('====================================================');
console.log('   雨霖铃 · 一比一复刻设计稿 双端视觉与布局验证');
console.log('====================================================\n');

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  \x1b[32m✔\x1b[0m ${message}`);
    passCount++;
  } else {
    console.error(`  \x1b[31m✘\x1b[0m ${message}`);
    failCount++;
  }
}

console.log('[1/8] 检查构建产物与页面文件:');
assert(fs.existsSync(DIST_INDEX), 'dist/index.html 存在');
assert(fs.existsSync(DIST_POSTS), 'dist/posts/index.html 存在');

if (!fs.existsSync(DIST_INDEX)) {
  console.error('构建产物不存在，请先执行 npm run build');
  process.exit(1);
}

const html = fs.readFileSync(DIST_INDEX, 'utf-8');
const cssDir = path.join(ROOT, 'dist', '_astro');
const css = fs.existsSync(cssDir)
  ? fs.readdirSync(cssDir).filter((name) => name.endsWith('.css')).map((name) => fs.readFileSync(path.join(cssDir, name), 'utf-8')).join('\n')
  : '';
const bundled = `${html}\n${css}`;

console.log('\n[2/8] 检查 100dvh 视口铺满与背景色:');
assert(html.includes('journal-paper'), '页面包含 journal-paper 标记');
assert(html.includes('100dvh'), 'CSS 包含 100dvh 视口高度定义');
assert(html.includes('viewport-fit=cover'), 'meta viewport 包含 viewport-fit=cover');

console.log('\n[3/8] 检查顶栏日夜天空 (ThemeSky):');
assert(html.includes('theme-sky'), '顶栏包含 ThemeSky 容器');
assert(html.includes('theme-sky-sun'), '包含太阳线稿 (theme-sky-sun)');
assert(html.includes('theme-sky-moon'), '包含月牙线稿 (theme-sky-moon)');
assert(html.includes('theme-sky-cloud'), '包含飘动云层 (theme-sky-cloud)');
assert(html.includes('theme-sky-star'), '包含闪烁星点 (theme-sky-star)');
assert(bundled.includes('theme-arc-rise'), '包含日夜升起动画');
assert(bundled.includes('sky-cloud-drift'), '包含云层水平漂移动画');
assert(bundled.includes('sky-star-twinkle'), '包含星星闪烁动画');
assert(html.includes('wordmark-wave'), '包含雨霖铃手绘波浪下划线');
assert(html.includes('theme-switch'), '包含桌面主题切换组');
assert(html.includes('mobile-theme'), '包含手机主题下拉菜单');
assert(!html.includes('masthead-sun-svg'), '已替换静态笑脸太阳');
assert(!html.includes('hero-sky'), 'Hero 区无误置天空块');

console.log('\n[4/8] 检查 Hero 标题与人物姿态区:');
assert(html.includes('hero-title-ending'), '标题包含「东西。」专属强调与波浪下划线');
assert(html.includes('先玩一局，再慢慢读。'), '文案精确匹配「先玩一局，再慢慢读。」');
assert(html.includes('pose-stage'), '人物区包含姿态舞台 (pose-stage)');
assert(html.includes('pose-nav'), '桌面悬停显示左右姿态箭头');
assert(html.includes('figure-btn'), '人物区包含姿态标签按钮');
assert(html.includes('角色姿态'), '姿态标签组无障碍名称匹配设计稿');

console.log('\n[5/8] 检查手机端单行收拢与响应式适配:');
assert(html.includes('data-theme-menu-trigger'), '手机端主题触发器存在');
assert(html.includes('nav-number'), '导航编号可在窄屏隐藏');
assert(html.includes('desktop-theme'), '桌面主题胶囊可在窄屏隐藏');

console.log('\n[6/8] 检查同页独立视图架构 (首页 / 游戏 / 关于 / 文章):');
assert(html.includes('data-view-panel="home"'), '首页独立视图面板 (home)');
assert(html.includes('data-view-panel="game"'), '游戏独立同页视图面板 (game)');
assert(html.includes('data-view-panel="about"'), '关于独立同页视图面板 (about)');
assert(html.includes('data-view-panel="articles"'), '文章独立同页视图面板 (articles)，切页不换 document.head');
assert(html.includes('<title>雨霖铃</title>'), '杂志首页 document.title 为雨霖铃');
assert(
  bundled.includes('clamp(28px, 6vw, 48px)') || bundled.includes('clamp(28px,6vw,48px)'),
  '次级视图顶距 clamp(28px, 6vw, 48px) 与设计稿一致',
);
assert(html.includes('data-nav-view="home"'), '点击品牌标题直达首页 (data-nav-view="home")');
assert(html.includes('← 回首页'), '次级视图返回文案匹配设计稿');
assert(html.includes('back-home-link'), '回首页使用统一 back-home-link');
assert(!html.includes('back-home-btn'), '首页不再使用独立 back-home-btn');

const postsHtml = fs.readFileSync(DIST_POSTS, 'utf-8');
assert(postsHtml.includes('back-home-link'), '文章页回首页使用统一 back-home-link');
assert(!postsHtml.includes('back-home-btn'), '文章页不再使用独立 back-home-btn');

console.log('\n[7/8] 检查游戏居中浮层窗口与 DOM 叠层提示:');
assert(!html.includes('四款线稿经典小游戏'), '已去除「四款线稿经典小游戏」标签');
assert(html.includes('game-modal-btn'), '包含全屏浮层图标按钮 (game-modal-btn)');
assert(html.includes('game-modal-backdrop'), '包含浮层半透明遮罩 (game-modal-backdrop)');
assert(html.includes('game-modal-close'), '包含浮层右上角关闭按钮 (game-modal-close)');
assert(html.includes('game-dom-overlay') && html.includes('game-dom-hint'), '包含高清 DOM 叠层提示 (game-dom-overlay)');
assert(bundled.includes('min(680px'), '浮层宽度匹配设计稿 min(680px, calc(100vw - 40px))');

console.log('\n[8/8] 检查回到顶部、时钟自动主题与切主题字色:');
assert(html.includes('data-back-to-top'), '包含回到顶部按钮');
assert(html.includes('getHours()'), '首屏防闪脚本按本地时钟解析自动主题');
assert(html.includes('clock.ts') || html.includes('clockPrefersDark') || html.includes('6 * 60'), '自动主题跟随时钟 06:00–18:00');
assert(bundled.includes('data-theme-switching'), '切主题时锁定字色插值 (data-theme-switching)');
assert(
  !/html,\s*body\s*\{[^}]*transition:\s*background-color 350ms ease,\s*color 350ms/.test(bundled),
  'html/body 不再对 color 做 350ms 插值',
);
assert(
  /@media\s*\(hover:\s*hover\)/.test(bundled),
  '按钮 hover 描边仅在 (hover: hover) 下生效',
);
assert(
  /outline-offset:\s*2px/.test(bundled),
  '按钮 hover 描边 outline-offset 2px 匹配设计稿',
);
assert(
  /outline-offset:\s*5px/.test(bundled),
  'focus-visible outline-offset 5px 匹配设计稿',
);
assert(
  /scrollbar-width:\s*none/.test(bundled),
  '全局滚动条隐藏 (scrollbar-width: none)',
);
assert(
  /border-radius:\s*0/.test(bundled),
  '回首页 hover 描边为直角矩形 (border-radius: 0)',
);

console.log('\n----------------------------------------------------');
if (failCount === 0) {
  console.log(`\x1b[32m✔ 全部 ${passCount} 项一比一复刻指标与双端布局验证通过！\x1b[0m`);
} else {
  console.error(`\x1b[31m✘ 存在 ${failCount} 项验证未通过，请检查代码。\x1b[0m`);
  process.exit(1);
}
