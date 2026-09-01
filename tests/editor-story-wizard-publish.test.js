#!/usr/bin/env node
/**
 * P4.4 — StoryWizard publish step: checklist, export gate, report.
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

function bootPublish() {
  const Editor = {
    data: null,
    isFinalScene(scene) {
      if (!scene) return false;
      const choices = scene.choices || [];
      if (choices.length) return false;
      return !scene.nextScene && !scene.combat?.nextScene;
    },
    buildStoryFlowModel() {
      const scenes = Editor.data?.scenes || {};
      const nodes = Object.keys(scenes).map((id) => {
        const sc = scenes[id];
        const choices = sc.choices || [];
        const validOut = choices.filter((c) => c?.to || c?.nextScene).length + (sc.nextScene ? 1 : 0);
        return {
          id,
          outCount: validOut,
          isFinal: validOut === 0 && !sc.sceneType,
          isHub: sc.sceneType === 'hub',
          inCount: 0
        };
      });
      const startId = Editor.data?.startScene || Object.keys(scenes)[0];
      const reachable = new Set(Object.keys(scenes));
      return { nodes, edges: [], reachable, startId, warnings: [] };
    },
    buildStoryFlowChecklist(model) {
      const hubIds = model.nodes.filter((n) => n.isHub).map((n) => n.id);
      const finalIds = model.nodes.filter((n) => n.isFinal).map((n) => n.id);
      return [{
        id: 'hub_to_final',
        status: hubIds.length && finalIds.length ? 'ok' : 'ok',
        detail: 'от хаба достижим финал',
        sceneIds: hubIds
      }];
    },
    collectProjectIssues() {
      const issues = [];
      if (!Editor.data?.startScene) {
        issues.push({
          id: 'no_start',
          severity: 'error',
          message: 'Не задана стартовая сцена',
          objectLabel: 'Проект'
        });
      }
      return {
        ok: !issues.length,
        issues,
        errors: issues.filter((i) => i.severity === 'error'),
        warnings: issues.filter((i) => i.severity === 'warning')
      };
    }
  };

  const ctx = {
    Editor,
    ProjectSchema: {
      resolveProjectStartSceneId(d) {
        return d.startScene || d.meta?.startScene || Object.keys(d.scenes || {})[0] || null;
      }
    },
    console,
    document: {
      getElementById() { return null; },
      createElement() { return { id: '', textContent: '', appendChild() {} }; },
      head: { appendChild() {} }
    },
    globalThis: null,
    module: { exports: {} }
  };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(read('js/editor/editor-story-wizard-publish.js'), ctx);
  return { Editor, Pub: ctx.StoryWizardPublish };
}

function sampleProject(overrides) {
  return Object.assign({
    meta: { title: 'Тест' },
    startScene: 'hub',
    scenes: {
      hub: {
        id: 'hub',
        location: 'Хаб',
        sceneType: 'hub',
        choices: [{ text: 'В путь', to: 'road', questSet: { questId: 'q1' } }]
      },
      road: {
        id: 'road',
        location: 'Дорога',
        choices: [{ text: 'Финал', to: 'end' }]
      },
      end: {
        id: 'end',
        location: 'Финал',
        choices: []
      }
    },
    quests: { q1: { id: 'q1', title: 'Первый квест', stages: [] } },
    npcs: { npc1: { id: 'npc1', name: 'Страж' } },
    playerCharacters: {}
  }, overrides || {});
}

console.log('StoryWizard publish');

{
  const { Editor, Pub } = bootPublish();
  Editor.data = sampleProject();
  const draft = { questId: 'q1', quest: { title: 'Первый квест' }, skipped: { quest: false } };
  const checklist = Pub.buildHumanChecklist(Editor, draft);
  assert(checklist.some((c) => c.id === 'has_start_scene' && c.status === 'ok'), 'стартовая сцена ok');
  assert(checklist.some((c) => c.id === 'first_quest_reachable' && c.status === 'ok'), 'квест достижим');
  assert(checklist.some((c) => c.id === 'scene_has_exit' && c.status === 'ok'), 'у сцен есть выходы');
  assert(checklist.some((c) => c.id === 'hub_to_final'), 'чеклист hub→final из story flow');
}

{
  const { Editor, Pub } = bootPublish();
  Editor.data = sampleProject({
    scenes: {
      hub: { id: 'hub', location: 'Хаб', sceneType: 'hub', choices: [] },
      stuck: { id: 'stuck', location: 'Застрял', choices: [{ text: 'Дальше' }] }
    },
    startScene: 'hub'
  });
  const dead = Pub.scenesWithoutExit(Editor);
  assert(dead.includes('hub'), 'хаб без выхода');
  assert(dead.includes('stuck'), 'сцена с выбором без перехода');
  const checklist = Pub.buildHumanChecklist(Editor, { skipped: { quest: true } });
  const exitItem = checklist.find((c) => c.id === 'scene_has_exit');
  assert(exitItem && exitItem.status === 'warn', 'предупреждение о сценах без выхода');
}

{
  const { Editor, Pub } = bootPublish();
  Editor.data = sampleProject({ startScene: '' });
  delete Editor.data.startScene;
  const report = Pub.buildPublishReport(Editor, { questId: 'q1' });
  assert(report.exportBlocked, 'экспорт заблокирован при ошибке валидатора');
  assert(report.exportBlockers.length > 0, 'список блокеров не пуст');
}

{
  const { Editor, Pub } = bootPublish();
  Editor.data = sampleProject();
  const report = Pub.buildPublishReport(Editor, { questId: 'q1' });
  assert(!report.exportBlocked, 'экспорт разрешён без ошибок');
  assert(report.summary.sceneCount === 3, 'сводка: 3 сцены');
  assert(report.summary.questTitle === 'Первый квест', 'сводка: название квеста');
}

{
  const { Editor, Pub } = bootPublish();
  Editor.data = sampleProject({
    scenes: {
      hub: { id: 'hub', location: 'Хаб', choices: [{ text: 'Дальше', to: 'road' }] },
      road: { id: 'road', location: 'Дорога', choices: [] }
    }
  });
  const reach = Pub.isQuestReachableFromStart(Editor, 'q1');
  assert(!reach.ok, 'квест не достижим без questSet');
}

{
  const { Editor, Pub } = bootPublish();
  const html = Pub.renderPublishStepHtml(Editor, {}, {
    exportCompleted: false,
    exportBlocked: true,
    exportBlockers: ['Ошибка 1'],
    errors: [{ objectLabel: 'Сцена', message: 'Битая ссылка' }],
    warnings: [],
    checklist: [{ id: 'x', status: 'ok', label: 'Тест', detail: 'ok' }],
    summary: { title: 'T', sceneCount: 1, questTitle: 'Q', heroName: 'H', npcCount: 0 }
  });
  assert(html.includes('Экспорт заблокирован'), 'HTML: блокировка экспорта');
  assert(html.includes('disabled'), 'кнопка экспорта disabled');
  assert(html.includes('Играть как герой'), 'HTML: кнопка превью');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
