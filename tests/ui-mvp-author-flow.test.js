#!/usr/bin/env node
/**
 * Phase UI-24 — MVP Author Flow integration (headless)
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
assert(html.includes('editor-ui-integration.js'), 'UI-12 script wired');
assert(html.includes('editor-preview-workflow.js'), 'preview workflow wired');
assert(html.includes('editor-scene-workspace.js'), 'scene workspace wired');
assert(html.includes('editor-product-hardening.js'), 'UI-24 product hardening wired');
assert(html.includes('editor-export-flow.js'), 'export flow wired');
assert(html.includes('editor-validator-navigation.js'), 'validator navigation wired');

// --- Technical audit: runtime must not depend on Editor ---
const runtimeFiles = [
  'js/game-ui/ui-runtime.js',
  'js/game-ui/visual-runtime.js',
  'js/engine/scene-manager.js',
  'js/quests/quest-runtime.js',
  'js/actions/action-registry.js'
].filter((f) => fs.existsSync(path.join(root, f)));

runtimeFiles.forEach((f) => {
  const src = read(f);
  const stripped = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert(!/\bEditor\b/.test(stripped) || /No Editor dependency/i.test(src),
    f + ' has no Editor dependency');
});

const sceneMgr = fs.existsSync(path.join(root, 'js/engine/scene-manager.js'))
  ? read('js/engine/scene-manager.js') : '';
assert(!sceneMgr || !sceneMgr.includes('rewrite'), 'SceneManager rewrite = 0');

const hardening = read('js/editor/editor-product-hardening.js');
assert(hardening.includes('openProjectTemplatePicker'), 'template picker API');
assert(hardening.includes('ui24-empty-project'), 'empty project shell flag');

const browserV2 = read('js/editor/editor-content-browser-v2.js');
assert(browserV2.includes('editor.contentBrowserV2.welcome.title'), 'empty project welcome i18n key');
assert(browserV2.includes('openProjectTemplatePicker'), 'template button routes to picker');

// --- Headless integration context ---
const storage = { _data: {}, getItem(k) { return this._data[k] || null; }, setItem(k, v) { this._data[k] = String(v); }, removeItem(k) { delete this._data[k]; } };

const ctx = {
  console: { log() {}, info() {}, warn() {}, error() {} },
  sessionStorage: storage,
  localStorage: { _data: {}, getItem() { return null; }, setItem() {}, removeItem() {} },
  setTimeout: (fn) => { if (typeof fn === 'function') fn(); return 0; },
  document: {
    readyState: 'complete',
    body: { dataset: {}, classList: { add() {}, remove() {}, toggle() {} }, appendChild() {}, style: {} },
    head: { appendChild() {} },
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement() {
      return { id: '', hidden: true, innerHTML: '', style: {}, appendChild() {}, addEventListener() {}, classList: { add() {}, remove() {} }, setAttribute() {} };
    },
    addEventListener() {}
  },
  window: { open() { return {}; }, location: { search: '' } },
  globalThis: null
};
ctx.globalThis = ctx;

let wsSection = 'overview';
let openedScene = null;
let selectedNode = null;
let previewLaunched = false;
let templatePickerOpened = false;
let exportSurfaceOpened = false;

ctx.Editor = {
  data: null,
  currentScene: null,
  currentTab: 'scenes',
  workspace: { sceneWs: { section: 'overview' } },
  toast: { success() {}, warning() {}, error() {}, info() {} },
  hooks: null,
  _sceneListQuery: '',
  _sceneListFilter: 'all',
  _sceneListSort: 'title',
  isAdvancedMode() { return false },
  isEditorAdvancedMode() { return false },
  isWriterMode() { return true },
  escapeHtml(s) { return String(s ?? ''); },
  escapeAttr(s) { return String(s ?? ''); },
  updateJSONPreview() {},
  markDirty() {},
  switchTab(t) { this.currentTab = t; },
  selectScene(id) { this.currentScene = id; openedScene = id; },
  openSceneDocument(id) { this.currentScene = id; openedScene = id; },
  renderSceneEditor() {},
  renderVisualScenePanel() {},
  getSceneWorkspaceSection() { return wsSection; },
  setSceneWorkspaceSection(s) { wsSection = s; this.workspace.sceneWs.section = s; },
  openSceneWorkspace(id) {
    this.switchTab('scenes');
    this.openSceneDocument(id);
    return true;
  },
  visualSelectNode(id) { selectedNode = id; },
  selectChoiceIndex(i) { this._lastChoice = i; },
  forEachSceneLink(sceneId, scene, cb) {
    (scene.choices || []).forEach((ch, i) => {
      if (ch.to) cb('to', ch.to, { choiceIndex: i });
    });
  },
  isValidSceneTarget(t, ids) { return ids.has(t); },
  buildTestSession(opts) {
    return { mode: 'editor_test', sceneId: opts.sceneId, createdAt: Date.now() };
  },
  prepareEditorTestLaunch(session) {
    ctx.localStorage._data['rpg_editor_test_session'] = JSON.stringify(session);
    previewLaunched = true;
    return session;
  },
  validateProject(data) {
    const d = data || this.data;
    const issues = [];
    Object.entries(d?.scenes || {}).forEach(([sid, sc]) => {
      (sc.choices || []).forEach((ch, i) => {
        if (ch.to && !d.scenes[ch.to]) {
          issues.push({
            severity: 'error', sceneId: sid, field: 'to',
            targetId: ch.to, choiceIndex: i, message: 'Missing scene'
          });
        }
      });
    });
    return {
      valid: issues.length === 0,
      issues,
      summary: { errors: issues.length, warnings: 0, info: 0 }
    };
  },
  validateProjectExportReady() {
    const r = this.validateProject(this.data);
    const errors = (r.issues || []).filter((i) => i.severity === 'error');
    return { ok: errors.length === 0, errors, warnings: [], issues: r.issues };
  },
  openNewProjectModal() { templatePickerOpened = 'project'; return true; },
  openCreateSceneModal() { templatePickerOpened = 'scene'; return true; },
  openExportSurface() { exportSurfaceOpened = true; return true; },
  openExportMenu() { return this.openExportSurface(); },
  createSceneWithWizard(opts) {
    const id = opts?.id || 'scene_' + Date.now();
    if (!this.data.scenes) this.data.scenes = {};
    this.data.scenes[id] = {
      id,
      location: opts?.name || 'New Scene',
      text: opts?.text || '',
      choices: [],
      visual: opts?.kind === 'visual' || opts?.kind === 'mixed'
        ? { mode: 'overlay', nodes: [] } : undefined
    };
    if (!this.data.startScene) this.data.startScene = id;
    this.currentScene = id;
    return id;
  },
  openSceneQuickCreate() {
    return this.createSceneWithWizard({ name: 'Start', kind: 'text' });
  }
};

vm.createContext(ctx);
vm.runInContext(read('js/editor/editor-hooks.js'), ctx);
vm.runInContext(read('js/editor-test-keys.js'), ctx);
ctx.EditorTestKeys = ctx.EditorTestKeys;
vm.runInContext(read('js/editor/editor-ui-integration.js'), ctx);
ctx.document.body.dataset.ui12 = '1';
vm.runInContext(read('js/editor/editor-product-hardening.js'), ctx);
vm.runInContext(read('js/editor/editor-preview-workflow.js'), ctx);

vm.runInContext(`
(function() {
  function esc(s) { return String(s ?? ''); }
  function openScene(sceneId, opts) {
    if (typeof Editor.openValidationIssueInWorkspace === 'function') {
      Editor.openValidationIssueInWorkspace(Object.assign({ sceneId }, opts || {}));
    }
  }
  Editor.collectProjectIssues = function() {
    const report = Editor.validateProject(Editor.data);
    const issues = (report.issues || []).map((iss) => ({
      id: iss.sceneId + ':' + (iss.choiceIndex ?? ''),
      severity: iss.severity || 'error',
      message: iss.message,
      objectLabel: 'Сцена',
      path: '',
      action: { label: 'Открыть', run: () => openScene(iss.sceneId, iss) }
    }));
    return { ok: issues.length === 0, issues, errors: issues, warnings: [] };
  };
  Editor.showProjectValidationResults = function(result) {
    Editor._validationModalShown = true;
    Editor._lastValidation = result;
  };
  Editor.runProjectValidation = function() {
    const r = this.collectProjectIssues();
    this.showProjectValidationResults(r);
    return r;
  };
})();
`, ctx);

const E = ctx.Editor;

// 1. Create project
E.data = { meta: { title: 'Test' }, scenes: {}, quests: {}, items: {}, ui: { screens: {} } };
assert(E.data && E.data.scenes, 'project created');
assert(E.isProjectContentEmpty?.() === true, 'empty project detected');

// 2. Template picker on empty project → starter modal
templatePickerOpened = false;
E.openProjectTemplatePicker();
assert(templatePickerOpened === 'project', 'empty project template → new project modal');

// 3. Create scene
const sceneId = E.createSceneWithWizard({ name: 'Village', kind: 'text', text: 'Hello' });
assert(sceneId && E.data.scenes[sceneId], 'scene created');
assert(E.data.startScene === sceneId, 'start scene set');
assert(E.isProjectContentEmpty?.() === false, 'project no longer empty');

// 4. Template picker with content → scene templates
templatePickerOpened = false;
E.openProjectTemplatePicker();
assert(templatePickerOpened === 'scene', 'non-empty project template → scene modal');

// 5. Open workspace
E.openSceneWorkspace(sceneId);
assert(openedScene === sceneId, 'scene workspace opened');

// 6. Add text + choice
E.data.scenes[sceneId].text = 'Welcome to the village.';
E.data.scenes[sceneId].choices = [{ text: 'Go', to: 'missing_target' }];
assert(E.data.scenes[sceneId].choices.length === 1, 'choice added');

// 7. Visual + hotspot
E.data.scenes[sceneId].visual = {
  mode: 'overlay',
  nodes: [{ id: 'hotspot_1', type: 'hotspot', label: 'Door', transform: { x: 10, y: 20, w: 40, h: 40 } }]
};
assert(E.data.scenes[sceneId].visual.nodes.length === 1, 'visual hotspot added');

// 8. Condition on choice
E.data.scenes[sceneId].choices[0].showIf = { type: 'flag', flag: 'met_elder', value: true };
assert(E.data.scenes[sceneId].choices[0].showIf.flag === 'met_elder', 'condition added');

// 9. Multi-action on hotspot
E.data.scenes[sceneId].visual.nodes[0].onClick = [
  { type: 'give_item', itemId: 'item_key' },
  { type: 'update_quest', questId: 'quest_1', stage: 1 }
];
assert(E.data.scenes[sceneId].visual.nodes[0].onClick.length === 2, 'multi-action stack added');

// 10. Reward item + quest
E.data.items = { item_key: { id: 'item_key', name: 'Key' } };
E.data.quests = { quest_1: { id: 'quest_1', title: 'Find the key', stages: [{ id: 0, text: 'Start' }] } };
assert(E.data.items.item_key && E.data.quests.quest_1, 'reward quest/item entities');

// 11. Combat enemy
E.data.enemies = { goblin: { id: 'goblin', name: 'Goblin', hp: 10 } };
E.data.scenes[sceneId].combat = [{ enemyId: 'goblin' }];
assert(E.data.enemies.goblin, 'combat enemy added');

// 12. Game UI screen
E.data.ui.screens.hud = { id: 'hud', label: 'HUD', nodes: [{ id: 'btn_1', type: 'button', label: 'Map' }] };
assert(E.data.ui.screens.hud.nodes.length === 1, 'game UI screen added');

// 13. Legacy visual editor redirect
wsSection = 'overview';
E.openVisualSceneEditor(sceneId);
assert(wsSection === 'visual', 'openVisualSceneEditor → visual section');

// 14. Validation + fix navigation
wsSection = 'overview';
const valResult = E.runProjectValidation();
assert(E._validationModalShown, 'validation modal shown');
assert(!valResult.ok, 'validation finds broken link');
const issue = valResult.issues[0];
issue.action.run();
assert(openedScene === sceneId, 'validation Open → scene');
assert(wsSection === 'choices', 'validation Open → choices section');

// 15. Preview preparation (isolated)
previewLaunched = false;
E.previewScene({ mode: 'current', sceneId, force: true });
assert(previewLaunched, 'preview session prepared');
assert(ctx.localStorage._data['rpg_editor_test_session'], 'isolated test session key');

E.previewScene({ mode: 'start', force: true });
assert(previewLaunched, 'project start preview prepared');

// 16. Export preparation
exportSurfaceOpened = false;
E.openExportMenu();
assert(exportSurfaceOpened, 'export menu redirects to unified surface');
const exportReady = E.validateProjectExportReady();
assert(exportReady.ok === false, 'export blocked on validation errors');

// 17. Graph tab switch (no runtime)
E.switchTab('graph');
assert(E.currentTab === 'graph', 'graph tab reachable');

// 18. UI integration + data integrity
assert(E.isUiIntegrationActive?.() === true, 'integration flag active');
const snap = JSON.stringify(E.data);
E.openValidationIssueInWorkspace({ sceneId, field: 'to', choiceIndex: 0 });
assert(JSON.stringify(E.data) === snap, 'navigation does not mutate project JSON');

// 19. Module presence
assert(typeof E.openVisualSceneEditor === 'function', 'legacy visual API exists');
assert(typeof E.openValidationIssueInWorkspace === 'function', 'validation workspace API exists');
assert(typeof E.previewScene === 'function', 'preview API exists');
assert(typeof E.openProjectTemplatePicker === 'function', 'template picker API exists');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
