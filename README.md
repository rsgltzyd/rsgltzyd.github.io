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

## 示例文章

示例身份只有 `src/components/articles/samplePosts.ts` 里的 `isSamplePost`。白名单是：

- `a-small-beginning`
- `keeping-a-field-notebook`

首页列表和文章页都调用这个函数，并标「示例文章」。正文保持英文。

## 检查

仓库使用 ESLint（JS / TS / Astro）与 `@astrojs/check` 做代码与类型检查。本地用 Node.js 22：

```sh
npm ci
npm run lint
npm run check
npm run build
```

需要自动修复可修复的格式或语法问题时可运行 `npm run lint:fix`。
