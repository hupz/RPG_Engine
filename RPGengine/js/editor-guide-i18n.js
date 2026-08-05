// Английские заголовки разделов руководства (тело — RU до полного перевода prose)

(function attachGuideSectionI18n() {
  const SECTIONS_EN = {
    intro: '1. Introduction: what you are building',
    changelog: '2. Engine updates (since the first guide version)',
    files: '3. Files and data flow',
    start: '4. Launching the editor and game',
    ui: '5. Editor interface',
    workflow: '6. Creating a game from scratch: step-by-step plan',
    tutorial: '7. Workshop: mini-campaign «The Lost Relic» (step by step)',
    'json-root': '8. game_data.json structure',
    'json-tab': '9. JSON tab: when you need it',
    meta: '10. Project metadata',
    'rule-systems': '11. Rule systems (D&D 5e / Pathfinder 2e)',
    scenes: '12. Scenes: full field reference',
    states: '13. Location states',
    choices: '14. Choices: transition, skill check, action',
    conditions: '15. Condition builder (showIf / hideIf)',
    questset: '16. Quest stage change on choice (questSet)',
    flags: '17. Flags and game memory',
    quests: '18. Quest system',
    classes: '19. Character classes',
    races: '20. Ancestries and heritages',
    'char-creator': '21. In-game character creator',
    abilities: '22. Abilities and effects',
    'ability-catalog': '23. Ability catalog in «Mill on the Quiet River»',
    progression: '24. Progression and levels (1–10, ASI)',
    items: '25. Items and equipment',
    'combat-systems': '26. Combat system',
    enemies: '27. Enemies, combat, scaling',
    npcs: '28. NPC reference',
    'scene-mechanics': '29. Component scenes and action chains',
    map: '30. Travel map',
    graph: '31. Story graph',
    audio: '32. Audio',
    theme: '33. UI theme',
    'play-ui': '34. Player interface',
    validate: '35. Project validation',
    export: '36. Saving and export',
    faq: '37. Common mistakes and FAQ',
    checklist: '38. Pre-release checklist',
    glossary: '39. Skills reference (Latin for skillCheck)',
    'plugin-api': '40. Plugin API for special scenes (legacy and extensions)',
    'custom-systems': '41. Creating custom rule systems'
  };

  const PARTS_EN = {
    i: 'Part I. Basics',
    ii: 'Part II. Creating a game',
    iii: 'Part III. Scenes & narrative',
    iv: 'Part IV. Characters & combat',
    v: 'Part V. Extending the engine',
    new: 'New in the engine'
  };

  function applyGuideLocale() {
    if (typeof I18n === 'undefined' || I18n.getLanguage() !== 'en') return;

    document.querySelectorAll('h2[id]').forEach((el) => {
      const text = SECTIONS_EN[el.id] || I18n.t('guide.sections.' + el.id);
      if (text && text !== 'guide.sections.' + el.id) el.textContent = text;
    });

    document.querySelectorAll('.part-title[data-guide-part]').forEach((el) => {
      const key = el.getAttribute('data-guide-part');
      if (PARTS_EN[key]) el.textContent = PARTS_EN[key];
    });

    document.querySelectorAll('#toc a').forEach((a) => {
      const href = a.getAttribute('href') || '';
      const id = href.replace('#', '');
      const text = SECTIONS_EN[id];
      if (text) a.textContent = text;
    });
  }

  if (typeof I18n !== 'undefined') I18n.onReady(applyGuideLocale);
  document.addEventListener('i18n-ready', applyGuideLocale);
})();
