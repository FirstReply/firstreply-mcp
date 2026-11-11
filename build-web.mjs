/**
 * Builds each widget (web/src/widgets/<Name>.tsx) into one self-contained HTML file in
 * web/dist: the script and the styles inline, nothing loaded from anywhere. The server serves
 * these files as ui://firstreply/<Name>.html resources.
 */

import * as esbuild from 'esbuild';
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('./web/', import.meta.url));
const widgets = readdirSync(`${root}src/widgets`).filter((file) => file.endsWith('.tsx')).map((file) => file.slice(0, -4));

// zod, which the MCP SDK and ext-apps pull in, re-exports every error-message locale from one
// index. Widgets only handle English protocol errors, so that index is replaced with English
// alone, which keeps 60 languages out of every widget.
const zodEnglishOnly = {
  name: 'zod-english-only',
  setup(build) {
    build.onLoad({ filter: /[\\/]zod[\\/]v4[\\/]locales[\\/]index\.js$/ }, () => ({
      contents: 'export { default as en } from "./en.js";',
      loader: 'js',
    }));
  },
};

mkdirSync(`${root}dist`, { recursive: true });

const css = (
  await esbuild.build({ entryPoints: [`${root}src/styles.css`], bundle: true, minify: true, write: false, logLevel: 'warning' })
).outputFiles[0].text;

for (const name of widgets) {
  const result = await esbuild.build({
    entryPoints: [`${root}src/widgets/${name}.tsx`],
    bundle: true,
    format: 'iife',
    minify: true,
    target: ['es2020'],
    jsx: 'automatic',
    // The styles are built once above and inlined into every widget
    loader: { '.css': 'empty' },
    plugins: [zodEnglishOnly],
    define: { 'process.env.NODE_ENV': '"production"' },
    write: false,
    logLevel: 'warning',
  });
  // A "</script" inside the bundle would end the inline script early
  const js = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
  writeFileSync(
    `${root}dist/${name}.html`,
    `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light dark">
<title>${name}</title>
<style>${css}</style>
</head>
<body>
<div id="root"></div>
<script>${js}</script>
</body>
</html>
`,
  );
  console.log(`built ${name} (${Math.round((js.length + css.length) / 1024)} kB)`);
}
