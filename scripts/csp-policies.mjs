/**
 * Content-Security-Policy (аудит v3, гл. 6).
 * Единый источник для build.mjs и тестов; editor-export.js дублирует GAME для standalone.
 */

/** legacy onclick= в статическом HTML и шаблонах innerHTML (не <script>-блоки) */
const SCRIPT_SRC_ATTR = "script-src-attr 'unsafe-inline'";

export const GAME_CSP_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  SCRIPT_SRC_ATTR,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "media-src 'self' data:",
  "connect-src 'self'",
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'"
].join('; ');

export const EDITOR_CSP_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-eval'",
  SCRIPT_SRC_ATTR,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "media-src 'self' data:",
  "connect-src 'self'",
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'"
].join('; ');

/** Руководство: только внешний editor-guide-i18n.js, без new Function */
export const GUIDE_CSP_POLICY = GAME_CSP_POLICY;

const CSP_META_RE = /<meta\s+http-equiv=["']Content-Security-Policy["'][^>]*>\s*/i;

/**
 * @param {string} html
 * @param {string} policy
 * @param {string} commentReason
 */
export function upsertCspMeta(html, policy, commentReason) {
  const block = `<!-- CSP (audit v3 ch.6): ${commentReason} -->\n<meta http-equiv="Content-Security-Policy" content="${policy}">\n`;
  if (CSP_META_RE.test(html)) {
    return html.replace(CSP_META_RE, block);
  }
  const viewportRe = /(<meta\s+name=["']viewport["'][^>]*>\s*)/i;
  if (viewportRe.test(html)) {
    return html.replace(viewportRe, `$1${block}`);
  }
  const charsetRe = /(<meta\s+charset=["'][^"']+["']>\s*)/i;
  if (charsetRe.test(html)) {
    return html.replace(charsetRe, `$1${block}`);
  }
  return html.replace(/<head>\s*/i, `<head>\n${block}`);
}

export function cspMetaPresent(html, policyFragment) {
  return CSP_META_RE.test(html) && html.includes(policyFragment);
}
