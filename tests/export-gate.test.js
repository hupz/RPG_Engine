#!/usr/bin/env node
/**
 * Export gate — единый guardExportWithValidation (editor-export-flow.js)
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

const flowSrc = read('js/editor/editor-export-flow.js');
const phaseHSrc = read('js/editor/editor-validation-phase-h.js');
const navSrc = read('js/editor/editor-validator-navigation.js');

assert(flowSrc.includes('guardExportWithValidation'), 'guard defined in export-flow');
assert(flowSrc.includes('isExportAllowed'), 'isExportAllowed API');
assert(!flowSrc.includes('_exportFlowValidated'), 'no _exportFlowValidated flag');
assert(!/guardExportWithValidation\s*\(opts\)\s*\{/.test(phaseHSrc), 'phase-h does not define guard body');
assert(phaseHSrc.includes('Editor.guardExportWithValidation'), 'phase-h wrappers delegate to guard');
assert(!navSrc.includes('guardExportWithValidationNav'), 'validator-nav does not patch guard');

let validationCalls = 0;
let confirmCalls = 0;
let confirmResult = true;
let validationModalShown = false;

function makeEditor() {
  return {
    data: { meta: { title: 'Test' }, scenes: { a: { id: 'a', text: 'x' } } },
    toast: { success() {}, warning() {}, error() {}, info() {} },
    escapeHtml(s) { return String(s); },
    confirmDialog: async (opts) => {
      confirmCalls++;
      return confirmResult;
    },
    showProjectValidationResults() {
      validationModalShown = true;
    },
    refreshValidationUI() {},
    exportJSON() { this._jsonCalled = (this._jsonCalled || 0) + 1; },
    exportHTML: async function () { this._htmlCalled = true; },
    exportGameStandalone: async function () { this._folderCalled = true; },
    ValidatorNav: {
      enrichIssue(iss) { return Object.assign({ severity: iss.severity }, iss); }
    }
  };
}

function boot(validation) {
  const ctx = {
    console: { log() {}, info() {}, warn() {}, error() {} },
    window: { showDirectoryPicker() {} },
    document: {
      readyState: 'complete',
      head: { appendChild() {} },
      body: { appendChild() {} },
      getElementById: () => null,
      createElement() {
        return { id: '', className: '', innerHTML: '', appendChild() {}, classList: { add() {}, remove() {} } };
      }
    },
    Editor: makeEditor()
  };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(read('js/editor/editor-hooks.js'), ctx);
  vm.runInContext(phaseHSrc, ctx);
  vm.runInContext(flowSrc, ctx);
  validationCalls = 0;
  confirmCalls = 0;
  validationModalShown = false;
  ctx.Editor.validateProjectExportReady = function () {
    validationCalls++;
    return validation;
  };
  return ctx;
}

async function runAsyncTests() {
  // Блокирующая ошибка — экспорт запрещён, модалка открыта
  confirmResult = false;
  const errVal = {
    ok: false,
    issues: [{ severity: 'error', message: 'broken' }],
    errors: [{ severity: 'error', message: 'broken' }],
    warnings: []
  };
  const errCtx = boot(errVal);
  const blocked = await errCtx.Editor.guardExportWithValidation();
  assert(blocked === false, 'guard blocks on errors when confirm declined');
  assert(validationCalls === 1, 'validation runs once for error guard');
  assert(validationModalShown, 'validation modal on blocking errors');

  confirmResult = true;
  const errForce = boot(errVal);
  const forced = await errForce.Editor.guardExportWithValidation();
  assert(forced === true, 'user can confirm past errors via dialog');
  assert(errForce.Editor.isExportAllowed() === false, 'isExportAllowed false with errors');

  // Предупреждение — явный confirm
  confirmResult = false;
  const warnVal = {
    ok: true,
    issues: [{ severity: 'warning', message: 'warn' }],
    errors: [],
    warnings: [{ severity: 'warning', message: 'warn' }]
  };
  const warnCtx = boot(warnVal);
  const warnBlocked = await warnCtx.Editor.guardExportWithValidation();
  assert(warnBlocked === false, 'warnings require explicit confirm');
  assert(confirmCalls === 1, 'confirm dialog for warnings');

  confirmResult = true;
  const warnOk = boot(warnVal);
  const warnAllowed = await warnOk.Editor.guardExportWithValidation();
  assert(warnAllowed === true, 'warnings pass after confirm');

  // Чистый проект — одна валидация, экспорт без лишних гейтов
  const cleanVal = { ok: true, issues: [], errors: [], warnings: [] };
  const cleanCtx = boot(cleanVal);
  const allowed = await cleanCtx.Editor.guardExportWithValidation();
  assert(allowed === true, 'clean project passes guard');
  assert(cleanCtx.Editor.isExportAllowed() === true, 'isExportAllowed on clean project');

  validationCalls = 0;
  await cleanCtx.Editor.ExportFlow.runExport('json');
  assert(cleanCtx.Editor._jsonCalled === 1, 'json export runs');
  assert(validationCalls === 1, 'runExport validates exactly once on clean project');

  // Legacy exportJSON wrapper — guard once
  validationCalls = 0;
  await cleanCtx.Editor.exportJSON();
  assert(validationCalls === 1, 'wrapped exportJSON validates once');

  // UI-22 runExport with errors — no double validation via guard
  validationCalls = 0;
  const uiErr = boot(errVal);
  const uiBlocked = await uiErr.Editor.ExportFlow.runExport('json');
  assert(uiBlocked === null, 'runExport blocked on errors');
  assert(!uiErr.Editor._jsonCalled, 'exportJSON not invoked when blocked');
  assert(validationCalls === 1, 'runExport single validation on error block');
}

runAsyncTests().then(() => {
  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
}).catch((e) => {
  console.error(e);
  process.exit(1);
});
