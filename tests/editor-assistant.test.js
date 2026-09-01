#!/usr/bin/env node
/**
 * Scene Assistant — draftScene stub, traceability, validation, apply semantics.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) { passed++; console.log('  ✓', msg); }
  else { failed++; console.error('  ✗', msg); }
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

const FIXED_DESCRIPTIONS = [
  {
    text: 'Таверна: диалог с барменом за стойкой',
    expectTemplate: ['tpl_tavern', 'tpl_dialogue'],
    expectAction: 'say'
  },
  {
    text: 'Сцена боя с волками в лесу',
    expectTemplate: 'tpl_combat',
    expectAction: 'start_combat',
    actionNeedsReview: true
  },
  {
    text: 'Развилка: идти в лес или вернуться в деревню',
    expectTemplate: 'tpl_fork',
    minLinks: 1
  },
  {
    text: 'Магазин: игрок покупает зелье',
    expectTemplate: 'tpl_shop',
    expectAction: 'open_panel'
  },
  {
    text: 'Старейшина даёт квест о пропаже козы',
    expectTemplate: 'tpl_quest_accept'
  }
];

function bootAssistantStack() {
  const Editor = {
    data: {
      scenes: {
        village: { id: 'village', location: 'Деревня', title: 'Деревня' },
        forest: { id: 'forest', location: 'Лес', title: 'Лес' },
        tavern: { id: 'tavern', location: 'Таверна', title: 'Таверна' }
      },
      items: { potion: { name: 'Зелье лечения' } },
      quests: { lost_goat: { title: 'Пропажа козы', stages: [{ id: 's1' }] } },
      enemies: { wolf: { name: 'Волк' } },
      npcs: {},
      shopInventories: {}
    },
    currentScene: 'village',
    renderSceneList() {},
    renderSceneEditor() {},
    updateJSONPreview() {},
    switchTab() {},
    markDirty() {},
    ensureSceneEditorModules(s) { return s.editorModules || []; },
    templates: {
      _r: new Map(),
      register(t) { this._r.set(t.id, t); },
      list() { return [...this._r.values()]; },
      run() {}
    },
    toast: { success() {}, warning() {}, error() {}, info() {} },
    slugifySceneId(name, existing) {
      let id = String(name || 'scene').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'new_scene';
      if (!existing[id]) return id;
      let n = 2;
      while (existing[id + '_' + n]) n++;
      return id + '_' + n;
    },
    createSceneWithWizard(name, intent) {
      if (!this.data.scenes) this.data.scenes = {};
      const id = this.slugifySceneId(name, this.data.scenes);
      const scene = { id, location: name };
      if (intent && intent.sceneType === 'combat') scene.combat = [];
      if (intent && intent.sceneType === 'dialog') scene.dialogue = [];
      this.data.scenes[id] = scene;
      this.currentScene = id;
      return id;
    }
  };

  const ctx = {
    Editor,
    console,
    document: {
      getElementById() { return null; },
      addEventListener() {},
      createElement() {
        return { id: '', textContent: '', appendChild() {}, setAttribute() {} };
      },
      head: { appendChild() {} }
    },
    window: {},
    module: { exports: {} },
    Object, Array, String, Math, Map, Set, JSON, RegExp
  };
  ctx.window = ctx;
  ctx.globalThis = ctx;
  vm.createContext(ctx);

  vm.runInContext(read('js/actions/action-registry.js'), ctx);
  vm.runInContext(read('js/editor/editor-action-catalog.js'), ctx);
  vm.runInContext(read('js/editor/editor-condition-catalog.js'), ctx);
  vm.runInContext(read('js/editor/editor-scene-authoring-index.js'), ctx);
  vm.runInContext(read('js/editor/editor-scene-template-pack.js'), ctx);
  vm.runInContext(read('js/editor/editor-assistant.js'), ctx);

  return {
    Editor: ctx.Editor,
    IDX: ctx.SceneAuthoringIndex,
    PV: null,
    AC: ctx.EditorActionCatalog,
    CC: ctx.EditorConditionCatalog,
    REG: ctx.ACTION_REGISTRY
  };
}

function loadValidator() {
  const ctx = {
    console,
    module: { exports: {} },
    globalThis: null,
    window: null,
    ACTION_REGISTRY: null,
    EditorActionCatalog: null,
    EditorConditionCatalog: null
  };
  ctx.globalThis = ctx;
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(read('js/actions/action-registry.js'), ctx);
  vm.runInContext(read('js/editor/editor-action-catalog.js'), ctx);
  vm.runInContext(read('js/editor/editor-condition-catalog.js'), ctx);
  vm.runInContext(read('js/editor/editor-project-validator.js'), ctx);
  return ctx.ProjectValidator;
}

function assertPlanTraced(plan) {
  if (plan.template) {
    assert(plan.template.source === 'template-pack', 'template source template-pack');
    assert(typeof plan.template.id === 'string' && plan.template.id.startsWith('tpl_'), 'template id tpl_*');
  }
  (plan.actions || []).forEach((a) => {
    assert(a.source === 'action-catalog', 'action source action-catalog: ' + a.id);
    assert(typeof a.id === 'string' && a.id.length > 0, 'action id set: ' + a.id);
  });
  (plan.conditions || []).forEach((c) => {
    assert(c.source === 'condition-catalog', 'condition source');
    assert(typeof c.id === 'string', 'condition id');
  });
  (plan.links || []).forEach((l) => {
    assert(l.source === 'scene', 'link source scene');
  });
  (plan.blocks || []).forEach((b) => {
    assert(b.source && b.id, 'block traced');
  });
}

function simulateApply(plan, Editor, IDX) {
  let sceneId;
  if (plan.template && !plan.template.needsReview) {
    sceneId = Editor.applySceneTemplatePack(plan.template.id);
  } else {
    sceneId = Editor.createSceneWithWizard(plan.sceneName, plan.wizardIntent || { sceneType: 'custom', displayMode: 'text' });
  }
  const scene = Editor.data.scenes[sceneId];
  Editor.assistant._applyConfidentItemsToScene(scene, plan);
  return { sceneId, scene };
}

console.log('editor-assistant.test.js');

const html = read('editor.html');
assert(html.includes('editor-assistant.js'), 'editor.html wires assistant core');
assert(html.includes('editor-assistant-ui.js'), 'editor.html wires assistant ui');
assert(!read('js/editor/editor-assistant.js').includes('fetch('), 'no fetch in assistant');
assert(!read('js/editor/editor-assistant.js').match(/api[_-]?key/i), 'no api keys in assistant');

const stack = bootAssistantStack();
const { Editor, IDX, AC, CC, REG } = stack;
const PV = loadValidator();

assert(!!Editor.assistant, 'Editor.assistant defined');
assert(typeof Editor.assistant.draftScene === 'function', 'draftScene');
assert(Editor.assistant.getProvider().id === 'stub-keywords', 'default stub provider');
assert(Editor.assistant.listProviders().some((p) => p.id === 'stub-keywords'), 'stub listed');

FIXED_DESCRIPTIONS.forEach((spec, i) => {
  const plan = Editor.assistant.draftScene(spec.text);
  assert(plan.ok === true, `#${i + 1} plan ok: ` + spec.text.slice(0, 40));
  assert(plan.providerId === 'stub-keywords', `#${i + 1} stub provider`);
  assert((Editor.assistant.validatePlan(plan) || []).length === 0, `#${i + 1} traceability valid`);

  assertPlanTraced(plan);

  if (spec.expectTemplate) {
    const ids = Array.isArray(spec.expectTemplate) ? spec.expectTemplate : [spec.expectTemplate];
    assert(ids.includes(plan.template?.id), `#${i + 1} template ` + ids.join('|') + ' got ' + (plan.template?.id || '—'));
  }
  if (spec.expectAction) {
    const act = (plan.actions || []).find((a) => a.id === spec.expectAction);
    assert(!!act, `#${i + 1} action ${spec.expectAction}`);
    if (spec.actionNeedsReview && act) {
      assert(act.needsReview === true, `#${i + 1} ${spec.expectAction} needsReview`);
    }
  }
  if (spec.minLinks) {
    assert((plan.links || []).length >= spec.minLinks, `#${i + 1} links >= ${spec.minLinks}`);
  }

  const beforeCount = Object.keys(Editor.data.scenes).length;
  const { sceneId, scene } = simulateApply(plan, Editor, IDX);
  assert(!!sceneId && !!scene, `#${i + 1} scene created`);
  assert(Object.keys(Editor.data.scenes).length >= beforeCount, `#${i + 1} scene added or patched`);

  assert(IDX.validateSceneShape(scene), `#${i + 1} validateSceneShape`);

  if (scene.showIf && typeof CC.validateConditionRules === 'function') {
    const cv = CC.validateConditionRules(scene.showIf);
    assert(cv.ok, `#${i + 1} condition rules valid`);
  }

  (scene.events?.enter || []).forEach((ev) => {
    assert(!!REG[ev.action], `#${i + 1} enter action in registry: ${ev.action}`);
    assert(!!AC.getActionDefinition(ev.action), `#${i + 1} enter action in catalog: ${ev.action}`);
  });

  const project = JSON.parse(JSON.stringify(Editor.data));
  project.startScene = project.startScene || 'village';
  const vr = PV.validateProject(project, { actionRegistry: REG, actionCatalog: AC, conditionCatalog: CC });
  assert(vr.valid === true || (vr.errors || []).every((e) => e.severity !== 'error'), `#${i + 1} project validator no errors`);
});

// needsReview не применяется молча
const combatPlan = Editor.assistant.draftScene('Сцена боя с волками в лесу');
const combatAct = (combatPlan.actions || []).find((a) => a.id === 'start_combat');
if (combatAct && combatAct.needsReview) {
  const { scene } = simulateApply(combatPlan, Editor, IDX);
  const hasCombat = (scene.events?.enter || []).some((e) => e.action === 'start_combat');
  assert(!hasCombat, 'start_combat with needsReview not applied');
}

// registerProvider slot
let customCalled = false;
Editor.assistant.registerProvider({
  id: 'test-provider',
  label: 'Test',
  draft() {
    customCalled = true;
    return {
      ok: true,
      description: 'x',
      sceneName: 'X',
      wizardIntent: { sceneType: 'custom', displayMode: 'text' },
      template: null,
      blocks: [],
      actions: [],
      conditions: [],
      links: [],
      warnings: [],
      needsReviewCount: 0
    };
  }
});
Editor.assistant.setProvider('test-provider');
Editor.assistant.draftScene('test');
assert(customCalled, 'external provider slot works');
Editor.assistant.setProvider('stub-keywords');

// undo hook for template apply (recordSceneCreate)
const historySrc = read('js/editor-history.js');
assert(historySrc.includes('recordSceneCreate'), 'history has recordSceneCreate');

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
