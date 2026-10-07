// Build: bundle + minify into dist/ (static, no server needed except the tiny /api/c challenge preview).
import { build, transform } from 'esbuild';
import fs from 'fs';
const V = Date.now().toString(36);
fs.rmSync('dist', { recursive: true, force: true }); fs.mkdirSync('dist');
await build({ entryPoints: ['src/main.js'], bundle: true, minify: true, format: 'iife', target: ['chrome80', 'safari14'], outfile: 'dist/app.js', legalComments: 'none' });
fs.writeFileSync('dist/app.css', (await transform(fs.readFileSync('src/app.css', 'utf8'), { loader: 'css', minify: true })).code);
fs.writeFileSync('dist/index.html', fs.readFileSync('src/index.html', 'utf8').replaceAll('__V__', V));
fs.writeFileSync('dist/sw.js', fs.readFileSync('src/sw.js', 'utf8').replaceAll('__V__', V));
fs.cpSync('public', 'dist', { recursive: true });
let total = 0; const walk = d => { for (const f of fs.readdirSync(d)) { const p = d + '/' + f; fs.statSync(p).isDirectory() ? walk(p) : (total += fs.statSync(p).size); } }; walk('dist');
const init = ['index.html', 'app.js', 'app.css', 'fonts/lilita-one-latin.woff2'].reduce((a, f) => a + fs.statSync('dist/' + f).size, 0);
console.log('built', V, 'initial load bytes', init, 'dist total', total);
