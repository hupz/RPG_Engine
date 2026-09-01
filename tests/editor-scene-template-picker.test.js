#!/usr/bin/env node
/**
 * Scene template picker — create vs replace semantics.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
let passed = 0;
let failed = 0;

function assert(c, m) {
  if (c) { passed++; console.log('  ✓', m); }
  else { failed++; console.error('  ✗', m); }
}

const builderSrc = fs.readFileSync(path.join(root, 'js/editor/editor-scene-builder.js'), 'utf8');
const packSrc = fs.readFileSync(path.join(root, 'js/editor/editor-scene-template-pack.js'), 'utf8');

assert(builderSrc.includes('createSceneFromBaseTemplate'), 'createSceneFromBaseTemplate API');
assert(builderSrc.includes('runSceneTemplateReplace'), 'runSceneTemplateReplace API');
assert(builderSrc.includes('snapshotSceneBeforeTemplateReplace'), 'history snapshot before replace');
assert(builderSrc.includes('buildSceneTemplateReplaceConfirmMessage'), 'confirm message mentions scene name');
assert(builderSrc.includes('текст, выборы и события'), 'confirm warns about overwrite fields');
assert(builderSrc.includes('История изменений для этой сцены сейчас недоступна'), 'honest when history unavailable');
assert(packSrc.includes("Editor._sceneTemplatePickerMode === 'replace'"), 'pack respects replace mode');
assert(packSrc.includes('applySceneTemplatePack(id)'), 'pack default click creates');
assert(packSrc.includes('applyToCurrent: true'), 'pack replace mode still patches current');

// Behavioral mini-test (isolated, no DOM)
const Editor = {
  data: {
    scenes: {
      hub: { id: 'hub', location: 'Хаб', text: 'Старый', choices: [{ text: 'A', to: 'x' }] }
    }
  },
  currentScene: 'hub',
  confirmDialog() { return Promise.resolve(true); },
  closeCreateSceneModal() {},
  toast: { success() {}, error() {} },
  buildSceneTemplateReplaceConfirmMessage(sceneId) {
    const s = this.data.scenes[sceneId];
    const name = s?.location || sceneId;
    const historyOk = !!(sceneId && this.data.scenes[sceneId] && this._historyOk);
    const historyNote = historyOk
      ? ' Перед заменой будет сохранён снимок сцены — отменить можно через «Отменить» (Ctrl+Z).'
      : ' История изменений для этой сцены сейчас недоступна — отменить замену через Ctrl+Z нельзя.';
    return `Сцена «${name}» будет перезаписана: текст, выборы и события входа заменятся содержимым шаблона.${historyNote}`;
  },
  isSceneHistorySupported(sceneId) {
    return !!(sceneId && this.data.scenes[sceneId] && this._historyOk);
  },
  snapshotSceneBeforeTemplateReplace(sceneId) {
    if (!this.isSceneHistorySupported(sceneId)) return false;
    this._snaps = (this._snaps || 0) + 1;
    return true;
  },
  requestSceneTemplateReplaceConfirm(sceneId) {
    return this.confirmDialog({ message: this.buildSceneTemplateReplaceConfirmMessage(sceneId) });
  },
  runSceneTemplateReplace(applyFn, sceneId) {
    return this.requestSceneTemplateReplaceConfirm(sceneId).then((ok) => {
      if (!ok) return false;
      this.snapshotSceneBeforeTemplateReplace(sceneId || this.currentScene);
      applyFn();
      return true;
    });
  },
  applySceneTemplateToCurrent() {
    this.data.scenes.hub.text = 'Новый';
    this.data.scenes.hub.choices = [];
  },
  createSceneFromBaseTemplate() {
    this.data.scenes.tavern = { id: 'tavern', location: 'Таверна', text: 'Новая' };
    this.currentScene = 'tavern';
    return 'tavern';
  }
};

const msg = Editor.buildSceneTemplateReplaceConfirmMessage('hub');
assert(msg.includes('«Хаб»'), 'confirm names target scene');
assert(msg.includes('недоступна'), 'no history note when unsupported');

Editor._historyOk = true;
const msg2 = Editor.buildSceneTemplateReplaceConfirmMessage('hub');
assert(msg2.includes('Ctrl+Z'), 'history note when supported');

const n0 = Object.keys(Editor.data.scenes).length;
const newId = Editor.createSceneFromBaseTemplate();
assert(newId === 'tavern' && Editor.data.scenes.hub.text === 'Старый', 'create leaves previous scene intact');
assert(Object.keys(Editor.data.scenes).length === n0 + 1, 'create adds scene');

Editor.runSceneTemplateReplace(() => Editor.applySceneTemplateToCurrent()).then((ok) => {
  assert(ok === true, 'replace flow succeeds');
  assert(Editor._snaps === 1, 'snapshot taken once');
  assert(Editor.data.scenes.hub.text === 'Новый', 'replace overwrites current');
  assert(Object.keys(Editor.data.scenes).length === n0 + 1, 'replace does not add scenes');

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
});
