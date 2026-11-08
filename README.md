# 雨霖铃

一份用 Astro 做的个人杂志。首页可以读文章、切换浅色 / 深色 / 自动主题。游戏区目前只有说明，能玩的版本还在后面。

## 本地

Node.js 22。不需要新增依赖。

```sh
npm ci
npm run dev
```

构建和预览：

```sh
npm run build
npm run preview
```

文章是 `src/content/posts/` 里的 Markdown。封面字段仍然必填。首页列表不展示封面，文章页保留封面。

## 主题

页面绘制前会读取 `localStorage` 的 `yl-theme-mode-v1`。

只接受三个精确值：`light`、`dark`、`auto`。没有这个键、空字符串、其他文字，或者读取存储失败，都用深色。

`auto` 跟随系统的 `prefers-color-scheme`。手动选了浅色或深色之后就停在那里，直到再选自动。另一个标签页改了同一个键时，当前页会跟着变。键被删掉或写成无效值时，回到深色。从往返缓存恢复页面时，会重新读这个键，不沿用离开前写在根节点上的旧模式。

如果这次写不进存储，页面仍改成刚选的颜色，状态会写明只在本次有效，不会改回深色。刷新或之后读取失败时，才按上一段的读取规则决定。

## 示例文章

示例身份只有 `src/components/articles/samplePosts.ts` 里的 `isSamplePost`。白名单是：

- `a-small-beginning`
- `keeping-a-field-notebook`

首页列表和文章页都调用这个函数，并标「示例文章」。正文保持英文。

## 检查

仓库里已有 `@astrojs/check` 和 TypeScript，没有单独的 check 脚本。本地用 Node.js 22：

```sh
npm ci
npm run build
npx --no-install astro check
```

浏览器验收、截图和对比度不在这个仓库里。记录放在仓外的 `/workspace/evidence/blog-home-redesign/pr-a/`。代码高亮若带内联颜色，样式表盖不过那些颜色；浅色和深色是否都可读，要在真实页面上看，这里不记成已通过。

## 部署

推到 `main` 之后，仍由仓库里现有的 GitHub Actions 构建并发布到 GitHub Pages。
