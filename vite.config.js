import { defineConfig } from 'vite';
import { existsSync, mkdirSync, readdirSync, copyFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

function copyDirRecursive(src, dest) {
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const s = join(src, entry.name);
    const d = join(dest, entry.name);
    if (entry.isDirectory()) copyDirRecursive(s, d);
    else copyFileSync(s, d);
  }
}

// Copies marketing-pages/ (SEO/content pages like /how-to-play.html,
// /fighters.html, /cosmetics.html) into dist/ after the build. These are
// web-only: the plugin is left out of the plugin list entirely in `capacitor`
// mode (see below), so `vite build --mode capacitor` — the command
// build:android/build:ios and the app-store CI workflows run before `cap
// sync` — never writes them into dist/, and they never reach the native app
// bundle.
function marketingPagesPlugin() {
  return {
    name: 'brawl-arena-marketing-pages',
    apply: 'build',
    closeBundle() {
      const src = resolve(import.meta.dirname, 'marketing-pages');
      const dest = resolve(import.meta.dirname, 'dist');
      if (existsSync(src)) copyDirRecursive(src, dest);
    },
  };
}

export default defineConfig(({ mode }) => ({
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    minify: 'esbuild',
  },
  server: {
    host: true,
    port: 5174,
  },
  plugins: mode === 'capacitor' ? [] : [marketingPagesPlugin()],
}));
