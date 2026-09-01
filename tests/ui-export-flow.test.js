#!/usr/bin/env node
/**
 * Phase UI-22 — Export flow tests
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..');

let passed = 0;
let failed = 0;
function assert(c, m) {
  if (c) { passed++; console.log('  ✓', m); }
  else { failed++; console.error('  ✗', m); }
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

const html = read('editor.html');
const flow = read('js/editor/editor-export-flow.js');
const exporter = read('js/editor-export.js');
const phaseH = read('js/editor/editor-validation-phase-h.js');

assert(html.includes('editor-export-flow.js'), 'export flow script wired');
assert(html.indexOf('editor-export-flow.js') > html.indexOf('editor-validation-phase-h.js'),
  'export flow loads after validation phase-h');
assert(flow.includes('openExportSurface'), 'unified export surface API');
assert(flow.includes('openExportMenu'), 'openExportMenu alias');
assert(flow.includes('Project JSON'), 'json format label');
assert(flow.includes('Standalone HTML'), 'html format label');
assert(flow.includes('Web Folder'), 'folder format label');
assert(flow.includes('showDirectoryPicker'), 'folder gated by browser capability');
assert(flow.includes('Editor.exportJSON'), 'calls existing exportJSON');
assert(flow.includes('Editor.exportHTML'), 'calls existing exportHTML');
assert(flow.includes('Editor.exportGameStandalone'), 'calls existing folder exporter');
assert(!flow.includes('function buildStandaloneHtml'), 'no duplicate HTML builder in flow module');
assert(exporter.includes('openExportSurface'), 'export menu routes to unified surface');
assert(exporter.includes('buildStandaloneHtml'), 'real HTML builder stays in editor-export.js');
assert(exporter.includes('STANDALONE_BODY_SCRIPTS'), 'real runtime script list');
assert(phaseH.includes('wrapExport'), 'existing export wrappers preserved');
assert(flow.includes('Export complete'), 'success result title');
assert(flow.includes('Generated files'), 'generated files section');
assert(!flow.includes('Open Folder'), 'does not promise open folder in browser');

function bootEditorCtx(opts) {
  opts = opts || {};
  const ctx = {
    console: { log() {}, info() {}, warn() {}, error() {} },
    window: opts.window || { showDirectoryPicker: function () {} },
    document: {
      readyState: 'complete',
      head: { appendChild() {} },
      body: { appendChild() {} },
      getElementById: () => null,
      createElement() {
        return {
          id: '', className: '', innerHTML: '', appendChild() {},
          classList: { add() {}, remove() {} }
        };
      }
    },
    Editor: Object.assign({
      data: { meta: { title: 'Demo RPG' }, scenes: { hub: { id: 'hub', text: 'Hi' } } },
      hooks: { register() {} },
      toast: { success() {}, warning() {}, error() {}, info() {} },
      escapeHtml(s) { return String(s); },
      validateProjectExportReady() {
        return opts.validation || { ok: true, issues: [], errors: [], warnings: [] };
      },
      guardExportWithValidation(guardOpts) {
        const r = ctx.Editor.validateProjectExportReady();
        if (r.ok) return true;
        if (guardOpts && guardOpts.force) return true;
        return (r.errors || []).length === 0;
      },
      exportJSON() { ctx._jsonCalled = true; },
      exportHTML: async function () { ctx._htmlCalled = true; },
      exportGameStandalone: async function () { ctx._folderCalled = true; },
      showProjectValidationResults() { ctx._validationShown = true; },
      applyValidatorExportGuardPatch() {}
    }, opts.editor || {})
  };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(flow, ctx);
  return ctx;
}

const ctx = bootEditorCtx();
const EF = ctx.Editor.ExportFlow;
assert(EF, 'ExportFlow exported');
assert(typeof ctx.Editor.openExportMenu === 'function', 'openExportMenu exported');

const formats = EF.getAvailableFormats();
assert(formats.some((f) => f.id === 'json'), 'json format available');
assert(formats.some((f) => f.id === 'html'), 'html format available');
assert(formats.some((f) => f.id === 'folder'), 'folder format available when supported');

const ctxNoPicker = bootEditorCtx({ window: {} });
assert(!ctxNoPicker.Editor.ExportFlow.getAvailableFormats().some((f) => f.id === 'folder'),
  'folder hidden without directory picker');

async function runAsyncTests() {
  const blockedCtx = bootEditorCtx({
    validation: {
      ok: false,
      issues: [{ severity: 'error', message: 'broken link' }],
      errors: [{ severity: 'error', message: 'broken link' }],
      warnings: []
    }
  });
  const blocked = await blockedCtx.Editor.ExportFlow.runExport('json');
  assert(blocked === null, 'errors block export execution');
  assert(!blockedCtx._jsonCalled, 'exportJSON not called when blocked');
  assert(blockedCtx._validationShown === true, 'validation modal on blocked export');

  const warnCtx = bootEditorCtx({
    validation: {
      ok: true,
      issues: [{ severity: 'warning', message: 'warn' }],
      errors: [],
      warnings: [{ severity: 'warning', message: 'warn' }]
    }
  });
  const ok = await warnCtx.Editor.ExportFlow.runExport('json');
  assert(ok && ok.files[0] === 'Demo_RPG.json', 'json export output contract');
  assert(warnCtx._jsonCalled, 'existing exportJSON called for warning-only project');

  const htmlCtx = bootEditorCtx();
  const htmlResult = await htmlCtx.Editor.ExportFlow.runExport('html');
  assert(htmlCtx._htmlCalled, 'existing exportHTML called');
  assert(htmlResult.files[0].endsWith('.html'), 'html output filename contract');
}

runAsyncTests().then(() => {
  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed > 0 ? 1 : 0);
}).catch((e) => {
  console.error(e);
  process.exit(1);
});
