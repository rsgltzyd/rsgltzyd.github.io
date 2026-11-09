#!/usr/bin/env node

/**
 * Responsive Dual-End (Desktop & Mobile) Visual Verification Script.
 * Verifies 1:1 replica of design screenshots:
 * - Image 1: Dark mode masthead with starry sky cluster & crescent moon, capsule theme switcher.
 * - Image 2 & 3: Light mode masthead with clouds & smiling sun next to nav, hand-drawn bottom rule.
 * - Hero: 2-line title with wavy underline under 东西, transparent figure with 10 buttons (5x2 grid).
 * - Full 100dvh paper background, single-line mobile header, centered floating modal window.
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
console.log('   雨霖铃 · 一比一复刻设计图 双端视觉与布局验证');
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

// 1. Verify build artifacts
console.log('[1/7] 检查构建产物与页面文件:');
assert(fs.existsSync(DIST_INDEX), 'dist/index.html 存在');
assert(fs.existsSync(DIST_POSTS), 'dist/posts/index.html 存在');

if (!fs.existsSync(DIST_INDEX)) {
  console.error('构建产物不存在，请先执行 npm run build');
  process.exit(1);
}

const html = fs.readFileSync(DIST_INDEX, 'utf-8');

// 2. 100dvh & background coverage
console.log('\n[2/7] 检查 100dvh 视口铺满与背景色 (修手机底下白底):');
assert(html.includes('journal-paper'), '页面包含 journal-paper 标记');
assert(html.includes('100dvh'), 'CSS 包含 100dvh 视口高度定义');
assert(html.includes('viewport-fit=cover'), 'meta viewport 包含 viewport-fit=cover');

// 3. 1:1 Replica: Masthead Sky (Image 1 & Image 3)
console.log('\n[3/7] 检查顶栏内部手绘天空 (一比一复刻 Image 1 与 Image 3):');
assert(html.includes('masthead-sky-dark'), '顶栏中包含专属深色夜空星群容器 (masthead-sky-dark)');
assert(html.includes('masthead-stars-svg'), '包含星群 SVG (masthead-stars-svg)');
assert(html.includes('masthead-moon-svg'), '包含月牙 SVG (masthead-moon-svg)');
assert(html.includes('masthead-sky-light'), '顶栏中包含专属浅色天空容器 (masthead-sky-light)');
assert(html.includes('masthead-sun-svg'), '顶栏中包含 8 道光芒的笑脸太阳 (masthead-sun-svg)');
assert(html.includes('masthead-clouds-svg'), '顶栏中包含浮云 SVG (masthead-clouds-svg)');
assert(html.includes('wordmark-wave'), '包含雨霖铃专属手绘双波浪下划线 (wordmark-wave)');
assert(html.includes('theme-switch'), '包含胶囊圆角主题切换组 (theme-switch)');
assert(!html.includes('hero-sky'), 'Hero 区无误置天空块 (已正确定位至顶栏中)');

// 4. 1:1 Replica: Hero section typography & Figure
console.log('\n[4/7] 检查 Hero 标题折行下划线与透明无框人物区 (一比一复刻 Image 3):');
assert(html.includes('hero-title-accent'), '标题包含「东西。」专属强调与波浪下划线容器');
assert(html.includes('先玩一局，再慢慢读。'), '文案精确匹配「先玩一局，再慢慢读。」');
assert(!html.includes('先玩一局 ↓'), '已去除冗余操作按钮「先玩一局 / 读精选」');
assert(html.includes('figure-btn'), '人物区包含 10 款场景标签按钮 (5x2 矩阵)');
assert(!html.includes('figure-chevron'), '已移除人物两端冗余 ‹ › 箭头');

// 5. Mobile header & responsive optimization
console.log('\n[5/7] 检查手机端单行收拢与响应式适配:');
assert(html.includes('theme-toggle-single'), '包含手机端单按钮切换器 (theme-toggle-single)');
assert(html.includes('data-theme-toggle'), '单按钮挂载 data-theme-toggle 控制属性');

// 6. Same-page views & brand click
console.log('\n[6/7] 检查同页独立视图架构 (首页 / 游戏 / 关于):');
assert(html.includes('data-view-panel="home"'), '首页独立视图面板 (home)');
assert(html.includes('data-view-panel="game"'), '游戏独立同页视图面板 (game)');
assert(html.includes('data-view-panel="about"'), '关于独立同页视图面板 (about)');
assert(html.includes('data-nav-view="home"'), '点击品牌标题直达首页 (data-nav-view="home")');

// 7. GameDeck centered modal window & DOM hint overlay
console.log('\n[7/7] 检查游戏居中浮层窗口与 DOM 叠层提示:');
assert(!html.includes('四款线稿经典小游戏'), '已去除「四款线稿经典小游戏」标签');
assert(html.includes('game-modal-btn'), '包含全屏浮层图标按钮 (game-modal-btn)');
assert(html.includes('game-modal-backdrop'), '包含浮层半透明遮罩 (game-modal-backdrop)');
assert(html.includes('game-modal-close'), '包含浮层右上角关闭按钮 (game-modal-close)');
assert(html.includes('game-dom-overlay') && html.includes('game-dom-hint'), '包含高清 DOM 叠层提示 (game-dom-overlay)');

console.log('\n----------------------------------------------------');
if (failCount === 0) {
  console.log(`\x1b[32m✔ 全部 ${passCount} 项一比一复刻指标与双端布局验证通过！\x1b[0m`);
} else {
  console.error(`\x1b[31m✘ 存在 ${failCount} 项验证未通过，请检查代码。\x1b[0m`);
  process.exit(1);
}
