import { defineConfig } from 'vite';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

// Absolute origin for og:image — social scrapers (WhatsApp, LinkedIn) ignore
// relative URLs. Set SITE_URL when the domain is known, e.g.
//   SITE_URL=https://ignuz26.kpriet.ac.in/ npm run build
const SITE_URL = process.env.SITE_URL ?? '';

export default defineConfig({
  base: './',
  plugins: [
    {
      name: 'site-url',
      transformIndexHtml: (html) => html.replaceAll('__SITE_URL__', SITE_URL),
    },
    {
      // Dev-only: lets tools/*.html pages render graphics in the browser and
      // save them as real files (OG image, static fallbacks).
      name: 'dev-save',
      apply: 'serve',
      configureServer(server) {
        server.middlewares.use('/__save', (req, res) => {
          const name = new URL(req.url, 'http://x').searchParams.get('name') ?? '';
          if (!/^[\w./-]+\.(png|webp|jpg)$/.test(name) || name.includes('..')) {
            res.statusCode = 400; return res.end('bad name');
          }
          const chunks = [];
          req.on('data', (c) => chunks.push(c));
          req.on('end', () => {
            const out = resolve('public', name);
            mkdirSync(dirname(out), { recursive: true });
            writeFileSync(out, Buffer.concat(chunks));
            res.end('saved ' + name);
          });
        });
      },
    },
  ],
  build: { target: 'es2020', assetsInlineLimit: 0 },
  server: { port: 5326 },
});
