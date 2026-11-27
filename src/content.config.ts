import { z } from 'astro/zod';
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';

const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/posts' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    tags: z.array(z.string()).default([]),
    cover: z.string().optional(),
    category: z.string().optional(),
    minutes: z.number().optional(),
    draft: z.boolean().default(false),
  }),
});

const gallery = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/gallery' }),
  schema: z.object({
    title: z.string(),
    pubDate: z.coerce.date(),
    location: z.string().optional(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
    images: z
      .array(
        z.object({
          src: z.string(),
          alt: z.string().optional(),
          caption: z.string().optional(),
        }),
      )
      .min(1),
  }),
});

export const collections = { posts, gallery };
