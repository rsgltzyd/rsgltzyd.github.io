# Personal Blog

A Markdown-powered personal blog built with Astro and deployed to GitHub Pages.

## Development

```sh
npm install
npm run dev
```

## Build

```sh
npm run build
npm run preview
```

Add posts as Markdown files in `src/content/posts/`. Each post needs a title, description, publication date, and cover image in its frontmatter. Set `draft: true` to keep a post out of the published site.

The included GitHub Actions workflow publishes the `dist/` output whenever changes are pushed to `main`. Enable GitHub Pages with **GitHub Actions** as the build and deployment source in the repository settings.