// Синхронизация персонажа после сцены создания (без правок engine.js)

function syncCharacterToUI(engine, character) {
  if (!engine) return;
  const c = character
    || (typeof CharacterCreationBridge !== 'undefined'
      ? CharacterCreationBridge.buildOutputFromDraft(engine, { classKey: engine.state.className, name: engine.state.charName, raceKey: engine.state.raceKey, stats: engine.state.stats })
      : {});
  if (c.name) engine.state.charName = c.name;

  engine.updateStats?.();
  engine.updateUI?.();
  engine.updateAbilityGrid?.();
  engine.renderAbilities?.();
  engine.renderSpellSlotsPanel?.();
  engine.syncMobileCompactBar?.();

  if (typeof engine.renderRelationsPanel === 'function') {
    engine.renderRelationsPanel();
  }

  if (c.class?.id) {
    engine.renderClassDisplay?.(c.class.id);
  }

  const raceName = c.race?.name || '';
  const className = c.class?.name || engine.data?.classes?.[engine.state.className]?.name || '';
  const lvl = c.level ?? engine.state.level ?? 1;
  engine.log(`Персонаж ${c.name || engine.state.charName} создан! ${raceName} ${className}, уровень ${lvl}`, 'log-heal');

  if (typeof QuestSystem !== 'undefined' && QuestSystem.onCharacterCreated) {
    QuestSystem.onCharacterCreated(engine, c);
  }
}

const CharacterCreationBridge = {
  ensureGameVisible(engine) {
    document.getElementById('char-creator-screen')?.classList.add('hidden');
    document.getElementById('class-screen')?.classList.add('hidden');
    document.getElementById('name-screen')?.classList.add('hidden');
    document.getElementById('game-content')?.classList.remove('hidden');
    document.getElementById('main')?.classList.remove('hidden');
    document.body.classList.remove('cc-fullscreen-active', 'scene-hide-log');
    engine?.clearSceneComponentsArea?.();
    if (typeof engine?.ensurePlayerUIVisible === 'function') {
      engine.ensurePlayerUIVisible({ force: true });
    }
  },

  resolveNextScene(engine, options = {}) {
    return options.nextScene
      || engine.data?.scenes?.[engine.state.scene]?.exitScene
      || engine.data?.scenes?.[engine.state.scene]?.templateParams?.nextScene
      || engine.data?.scenes?.char_creation?.templateParams?.nextScene
      || (engine.data?.scenes?.start ? 'start' : null)
      || (engine.data?.scenes?.village_hub ? 'village_hub' : null)
      || engine.getFirstStorySceneId?.();
  },

  buildOutputFromDraft(engine, draft) {
    const d = draft || {};
    const races = engine.data?.races || {};
    const classes = engine.data?.classes || {};
    const race = d.raceKey && races[d.raceKey] ? { id: d.raceKey, name: races[d.raceKey].name, traits: races[d.raceKey].traits || [] } : null;
    const cls = d.classKey && classes[d.classKey] ? classes[d.classKey] : null;
    const stats = d.stats ? { ...d.stats } : {};
    const conMod = engine.getModifier?.(stats.con ?? 10) ?? 0;
    const maxHp = engine.getClassLevel1Hp?.(d.classKey, conMod) ?? 10;
    const dmgRoll = cls?.dmgRoll || '1d6';
    const dmgBonus = cls?.dmgBonus ?? 0;

    return {
      id: 'hero',
      name: (d.name || '').trim() || 'Герой',
      race,
      class: cls ? {
        id: d.classKey,
        name: cls.name,
        hd: cls.hpHitDie,
        abilities: (cls.abilities || []).map((a) => ({
          id: a.id,
          name: a.name,
          description: a.desc || '',
          level: a.level || 1
        }))
      } : null,
      level: 1,
      hp: maxHp,
      maxHp,
      tempHp: 0,
      ac: cls?.ac ?? 10,
      attackBonus: cls?.atkBonus ?? 0,
      damage: `${dmgRoll}${dmgBonus ? (dmgBonus > 0 ? '+' : '') + dmgBonus : ''}`,
      initiative: cls?.initBonus ?? 0,
      gold: 0,
      xp: 0,
      xpToNext: engine.data?.progression?.xpTable?.[1] ?? 100,
      abilities: [],
      inventory: [...(cls?.startingItems || [])].map((id) => ({
        id,
        name: engine.data?.items?.[id]?.name || id,
        type: engine.data?.items?.[id]?.type || 'item',
        equipped: false,
        quantity: 1,
        effects: []
      })),
      equipment: { weapon: null, armor: null, shield: null, accessory1: null, accessory2: null },
      spellSlots: { current: [], max: [] },
      skills: (d.skills || []).map((sid) => ({ name: sid, proficiency: true, bonus: 0 })),
      conditions: [],
      reputation: { factions: {} },
      resources: { inspiration: 0, hitDice: 1 },
      portrait: d.portrait || '',
      backstory: d.backstory || '',
      notes: '',
      draft: d
    };
  },

  applyDraft(engine, draft, options = {}) {
    if (!draft?.classKey) return false;
    const origShow = engine.showScene.bind(engine);
    engine.showScene = function () {};
    try {
      engine.finalizeCharacter(draft);
    } finally {
      engine.showScene = origShow;
    }
    const character = this.buildOutputFromDraft(engine, draft);
    character.name = engine.state.charName;
    syncCharacterToUI(engine, character);
    this.ensureGameVisible(engine);

    if (!options.skipNavigation) {
      const next = this.resolveNextScene(engine, options);
      if (next && engine.data?.scenes?.[next]) {
        engine.showScene(next, { forceRevisit: true });
      } else {
        engine.setText?.('Сцена начала не найдена. Проверьте game_data.json.');
        engine.setChoices?.([]);
      }
    }
    return true;
  }
};

function patchCharacterCreationStartup() {
  if (typeof GameEngine === 'undefined' || GameEngine._charCreationStartupPatched) return;
  GameEngine._charCreationStartupPatched = true;
  const orig = GameEngine.handleStartupRoute.bind(GameEngine);
  GameEngine.handleStartupRoute = function () {
    this.hideCampaignPicker();
    if (this.needsCharacterCreation() && this.data?.scenes?.char_creation) {
      document.getElementById('char-creator-screen')?.classList.add('hidden');
      document.getElementById('class-screen')?.classList.add('hidden');
      document.getElementById('name-screen')?.classList.add('hidden');
      document.getElementById('main')?.classList.remove('hidden');
      document.getElementById('game-content')?.classList.remove('hidden');
      this.showScene('char_creation');
      return;
    }
    return orig();
  };
}

if (typeof GameEngine !== 'undefined') {
  GameEngine.scripts = GameEngine.scripts || {};
  GameEngine.scripts.syncCharacterToUI = syncCharacterToUI;
  patchCharacterCreationStartup();
} else {
  document.addEventListener('DOMContentLoaded', patchCharacterCreationStartup);
}

if (typeof window !== 'undefined') {
  window.syncCharacterToUI = syncCharacterToUI;
  window.CharacterCreationBridge = CharacterCreationBridge;
}
