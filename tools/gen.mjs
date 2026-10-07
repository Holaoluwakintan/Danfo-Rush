import { build } from 'esbuild'; import fs from 'fs'; import { chromium } from 'playwright-core';
await build({ entryPoints: ['tools/gen.js'], bundle: true, outfile: 'dist/gen.bundle.js', format: 'iife' });
fs.copyFileSync('tools/gen.html', 'dist/gen.html');
const b = await chromium.launch({ args: ['--no-sandbox'] }); const p = await b.newPage();
await p.goto('http://127.0.0.1:4780/gen.html'); await p.evaluate(() => document.fonts.load('40px "Lilita One"')); await p.waitForTimeout(300);
const save = async (expr, f) => { const d = await p.evaluate(expr); fs.writeFileSync(f, Buffer.from(d.split(',')[1], 'base64')); };
await save('icon(192)', 'public/icons/icon-192.png'); await save('icon(512)', 'public/icons/icon-512.png'); await save('icon(512,true)', 'public/icons/maskable-512.png');
await save('og(false)', 'public/og.png'); await save('og(true)', 'public/og-challenge.png');
await b.close(); fs.rmSync('dist/gen.bundle.js'); fs.rmSync('dist/gen.html'); console.log('ok');
