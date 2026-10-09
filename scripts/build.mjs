import { build } from 'esbuild';
import { copyFile, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, relative, resolve } from 'node:path';
import { zipSync } from 'fflate';

const require = createRequire(import.meta.url);
const root = resolve(import.meta.dirname, '..');
const dist = join(root, 'dist');

await rm(dist, { recursive: true, force: true });
await mkdir(join(dist, 'vendor'), { recursive: true });

for (const file of ['manifest.json', 'popup.html', 'popup.css', 'popup.js', 'content.js']) {
  await copyFile(join(root, 'extension', file), join(dist, file));
}

// Package the audited, pinned WA-JS dependency locally: never load remote extension code.
await copyFile(require.resolve('@wppconnect/wa-js'), join(dist, 'vendor', 'wppconnect-wa.js'));
await build({
  entryPoints: [join(root, 'src', 'page.js')],
  outfile: join(dist, 'page.js'),
  bundle: true,
  platform: 'browser',
  format: 'iife',
  target: 'es2022',
  minify: true,
  legalComments: 'none'
});
console.log('Build completed:', dist);

if (process.argv.includes('--package')) {
  const files = {};
  async function visit(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) await visit(path);
      else files[relative(dist, path).replaceAll('\\', '/')] = new Uint8Array(await readFile(path));
    }
  }
  await visit(dist);
  const version = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')).version;
  const destination = join(root, 'wa-bulk-export-' + version + '.zip');
  await writeFile(destination, zipSync(files, { level: 6 }));
  console.log('Extension package:', destination);
}
