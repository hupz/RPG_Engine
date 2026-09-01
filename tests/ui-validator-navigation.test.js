#!/usr/bin/env node
/**
 * Phase UI-21 — Validator UX navigation tests
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
const nav = read('js/editor/editor-validator-navigation.js');
const ux = read('js/editor/editor-project-validator-ux.js');
const phaseH = read('js/editor/editor-validation-phase-h.js');

assert(html.includes('editor-validator-navigation.js'), 'validator navigation wired');
assert(nav.includes('renderGroupedIssueList'), 'grouped issue list');
assert(nav.includes('Open and Fix'), 'open and fix label');
assert(nav.includes('ERRORS'), 'errors group');
assert(nav.includes('WARNINGS'), 'warnings group');
assert(nav.includes('parseJsonPath'), 'path parser');
assert(nav.includes('getSceneValidationIssues'), 'scene validation API');
assert(nav.includes('guardExportWithValidation'), 'export guard patch');
assert(!nav.includes('SceneManager'), 'no runtime dependency');

const data = {
  meta: { title: 'Demo' },
  startScene: 'hub',
  scenes: {
    hub: {
      id: 'hub',
      location: 'Village',
      choices: [{ text: 'Enter Tavern', to: 'missing_tavern' }],
      visual: { nodes: [{ id: 'door', label: 'Tavern Door', kind: 'hotspot' }] }
    }
  },
  items: {},
  npcs: {},
  quests: {}
};

const ctx = {
  console: { log() {}, info() {}, warn() {}, error() {} },
  document: {
    head: { appendChild() {} },
    body: { appendChild() {} },
    getElementById: () => null,
    createElement() {
      return { id: '', className: '', innerHTML: '', appendChild() {}, classList: { add() {}, remove() {} } };
    }
  },
  Editor: {
    data,
    hooks: { register() {} },
    toast: { success() {}, warning() {}, error() {}, info() {} },
    updateJSONPreview() {},
    escapeHtml(s) { return String(s); },
    collectProjectIssues() {
      return {
        ok: false,
        issues: [{
          id: 'missing_scene:hub',
          severity: 'error',
          type: 'missing_scene',
          message: 'missing scene',
          sceneId: 'hub',
          targetId: 'missing_tavern',
          path: 'scenes.hub.choices[0].to',
          raw: {
            type: 'missing_scene',
            severity: 'error',
            sceneId: 'hub',
            targetId: 'missing_tavern',
            path: 'scenes.hub.choices[0].to'
          }
        }, {
          id: 'warn:hub',
          severity: 'warning',
          type: 'empty_scene',
          message: 'Scene is empty',
          sceneId: 'hub',
          path: 'scenes.hub'
        }],
        errors: [],
        warnings: []
      };
    },
    showProjectValidationResults() {},
    openValidationIssueInWorkspace(payload) {
      ctx._lastOpen = payload;
      return true;
    },
    openSceneWorkspace(sceneId, opts) {
      ctx._lastWorkspace = { sceneId, opts };
      return true;
    },
    setSceneWorkspaceSection(section) {
      ctx._lastSection = section;
    },
    selectChoiceIndex(idx) {
      ctx._lastChoice = idx;
    },
    visualSelectNode(id) {
      ctx._lastNode = id;
    },
    validateProjectExportReady() {
      return {
        ok: false,
        issues: [{ severity: 'error', type: 'export_no_scenes', message: 'no scenes', tab: 'scenes' }],
        errors: [{ severity: 'error', type: 'export_no_scenes', message: 'no scenes', tab: 'scenes' }],
        warnings: [{ severity: 'warning', type: 'export_old_data_version', message: 'old version', tab: 'json' }]
      };
    },
    guardExportWithValidation() { return true; },
    navigateToValidationIssue() { return false; }
  }
};
ctx.globalThis = ctx;
ctx.window = ctx;

vm.createContext(ctx);
vm.runInContext(nav, ctx);

const V = ctx.Editor.ValidatorNav;
assert(V, 'ValidatorNav exported');
assert(typeof ctx.Editor.getSceneValidationIssues === 'function', 'getSceneValidationIssues exported');
assert(typeof ctx.Editor.navigateToValidatorIssue === 'function', 'navigateToValidatorIssue exported');

const pathCtx = V.parseJsonPath('scenes.hub.choices[0].to');
assert(pathCtx.sceneId === 'hub', 'path parser sceneId');
assert(pathCtx.choiceIndex === 0, 'path parser choiceIndex');
assert(pathCtx.section === 'choices', 'path parser section');

const nodeCtx = V.parseJsonPath('scenes.hub.visual.nodes[door].onClick');
assert(nodeCtx.nodeId === 'door', 'path parser nodeId');
assert(nodeCtx.section === 'visual', 'path parser visual section');

const issue = {
  severity: 'error',
  type: 'missing_scene',
  message: 'raw',
  sceneId: 'hub',
  targetId: 'missing_tavern',
  path: 'scenes.hub.choices[0].to',
  raw: {
    type: 'missing_scene',
    sceneId: 'hub',
    targetId: 'missing_tavern',
    path: 'scenes.hub.choices[0].to'
  }
};
const enriched = V.enrichIssue(issue, data);
assert(enriched.title === 'Broken Scene Link', 'human title');
assert(enriched.description.includes('Enter Tavern'), 'human description uses choice text');
assert(enriched.description.includes('missing_tavern'), 'description mentions target');
assert(enriched.location.includes('Village'), 'location includes scene');
assert(enriched.action && typeof enriched.action.run === 'function', 'open action exists');

enriched.action.run();
assert(ctx._lastOpen.sceneId === 'hub', 'open target scene');
assert(ctx._lastOpen.choiceIndex === 0, 'open target choice index');

const grouped = V.renderGroupedIssueList([enriched, {
  severity: 'warning',
  title: 'Empty Scene',
  description: 'warn',
  location: 'Village',
  message: 'warn'
}]);
assert(grouped.includes('ERRORS'), 'grouped errors section');
assert(grouped.includes('WARNINGS'), 'grouped warnings section');
assert(grouped.includes('Open and Fix'), 'grouped primary action');

// collectProjectIssues enrichment patch
ctx._lastOpen = null;
ctx.Editor.collectProjectIssues();
const patched = ctx.Editor.collectProjectIssues();
assert(patched.issues[0].title === 'Broken Scene Link', 'collect patch enriches issues');
assert(Array.isArray(patched.info), 'info array present');

// scene issue filter
const sceneIssues = ctx.Editor.getSceneValidationIssues('hub');
assert(sceneIssues.length >= 1, 'scene validation issues');

// export guard policy: errors block, warnings pass (source-level)
assert(nav.includes('Export blocked'), 'export hard block message');
assert(nav.includes('return false'), 'export returns false on errors');
assert(nav.includes('warnCount > 0') && nav.includes('return true'), 'warnings allow export');
assert(phaseH.includes('guardExportWithValidation'), 'phase-h export gate exists');
assert(phaseH.includes('wrapExport'), 'export wrappers exist');

// navigation mapping in ui-integration
const integration = read('js/editor/editor-ui-integration.js');
assert(integration.includes('openValidationIssueInWorkspace'), 'workspace navigation API');

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
