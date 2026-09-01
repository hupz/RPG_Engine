/**
 * Парсинг <script> из editor.html в порядке документа.
 */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

export const SCRIPT_TAG_RE = /<script([^>]*)>([\s\S]*?)<\/script>/gi;

/**
 * @param {string} htmlSource
 * @returns {{ external: { src: string, index: number, full: string }[], inline: { code: string, index: number, full: string }[] }}
 */
export function parseEditorScripts(htmlSource) {
  const external = [];
  const inline = [];
  const re = new RegExp(SCRIPT_TAG_RE.source, SCRIPT_TAG_RE.flags);
  let m;
  while ((m = re.exec(htmlSource)) !== null) {
    const attrs = m[1];
    const body = m[2];
    const srcMatch = attrs.match(/\bsrc\s*=\s*["']([^"']+)["']/i);
    if (srcMatch) {
      external.push({ src: srcMatch[1], index: m.index, full: m[0] });
    } else if (body.trim()) {
      inline.push({ code: body.trim(), index: m.index, full: m[0] });
    }
  }
  return { external, inline };
}

if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('parse-editor-scripts.mjs')) {
  const html = readFileSync(join(root, 'editor.html'), 'utf8');
  const { external, inline } = parseEditorScripts(html);
  console.log('external:', external.length);
  console.log('inline:', inline.length);
  const cdn = external.filter((e) => /^https?:\/\//i.test(e.src));
  if (cdn.length) console.log('cdn:', cdn.map((e) => e.src));
}
