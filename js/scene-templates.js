// ============================================
// Шаблоны сцен — генерация из типа + параметров
// ============================================

const SceneTemplateEngine = (function () {
  /** 9 базовых шаблонов (неизменяемые определения) */
  const BASE_TEMPLATES = {
    village_hub: {
      id: 'village_hub',
      icon: '🏘️',
      label: 'Деревня (хаб)',
      special: null,
      fields: ['id', 'name', 'bg', 'locations', 'exit']
    },
    shop: {
      id: 'shop',
      icon: '🏪',
      label: 'Магазин',
      special: 'shop',
      fields: ['id', 'name', 'bg', 'merchant', 'inventory', 'exit']
    },
    tavern: {
      id: 'tavern',
      icon: '🏚️',
      label: 'Таверна',
      special: null,
      fields: ['id', 'name', 'bg', 'innkeeper', 'menu', 'roomPrice', 'exit']
    },
    blacksmith: {
      id: 'blacksmith',
      icon: '⚒️',
      label: 'Кузница',
      special: 'blacksmith',
      fields: ['id', 'name', 'bg', 'blacksmith', 'services', 'exit']
    },
    temple: {
      id: 'temple',
      icon: '⛪',
      label: 'Храм',
      special: null,
      fields: ['id', 'name', 'bg', 'priest', 'services', 'exit']
    },
    dungeon: {
      id: 'dungeon',
      icon: '🕳️',
      label: 'Подземелье',
      special: null,
      fields: ['id', 'name', 'bg', 'difficulty', 'enemies', 'loot', 'exit']
    },
    dialogue: {
      id: 'dialogue',
      icon: '💬',
      label: 'Диалог',
      special: null,
      fields: ['id', 'name', 'bg', 'npc', 'topics', 'exit']
    },
    combat: {
      id: 'combat',
      icon: '⚔️',
      label: 'Бой',
      special: null,
      fields: ['id', 'name', 'bg', 'enemies', 'loot', 'winScene', 'loseScene', 'exit']
    },
    loot_search: {
      id: 'loot_search',
      icon: '🔍',
      label: 'Поиск добычи',
      special: null,
      fields: ['id', 'name', 'bg', 'items', 'dc', 'skill', 'exit']
    }
  };

  /** Тексты по умолчанию (можно переопределить в data.sceneTemplateDefs.custom) */
  const DEFAULT_STRINGS = {
    village_hub: {
      intro: 'Вы на площади {locationName}. Отсюда расходятся дороги посёлка.\n\nКуда направитесь?',
      rest: '🛏️ Отдохнуть (короткий отдых)',
      exit: '🚪 Покинуть площадь'
    },
    shop: {
      greeting: '{merchantName} приветствует вас.\n\n«{greetingLine}»\n\nНа прилавке: {itemList}.',
      greetingLine: 'У меня есть всё нужное для путника.',
      buyBtn: '💰 Купить {itemName} ({price} зм)',
      sellBtn: '💰 Продать предмет',
      talkBtn: '🗣️ Поговорить',
      leaveBtn: '🚪 Уйти'
    },
    tavern: {
      intro: 'Вы входите в {locationName}. Пахнет едой и дымом очага.\n\n{innkeeperName} кивает вам с порога.',
      menuBtn: '🍺 Заказать из меню',
      roomBtn: '🛏️ Снять комнату ({roomPrice} зм)',
      rumorsBtn: '📰 Спросить о слухах',
      restBtn: '🛏️ Отдохнуть',
      leaveBtn: '🚪 Выйти'
    },
    blacksmith: {
      intro: 'Жар кузницы обжигает лицо. {blacksmithName} откладывает молот:\n\n«Нужна заточка или ремонт — говори.»',
      enhanceBtn: '⚒️ Заточить снаряжение',
      leaveBtn: '🚪 Уйти'
    },
    temple: {
      intro: 'В {locationName} тихо и прохладно. {priestName} поднимает глаза от молитвы.',
      healBtn: '✨ Лечение ({healPrice} зм)',
      curseBtn: '☦️ Снять проклятие',
      blessBtn: '🙏 Благословение',
      leaveBtn: '🚪 Выйти'
    },
    dungeon: {
      intro: 'Перед вами {locationName}. Во мраке слышны капли воды. Сложность: {difficultyLabel}.',
      enterBtn: '⚔️ Войти и сразиться',
      trapBtn: '🪤 Осторожно искать ловушки',
      leaveBtn: '🚪 Отступить'
    },
    dialogue: {
      greeting: '{npcName} смотрит на вас.\n\n«{greetingLine}»',
      greetingLine: 'Чем могу помочь?',
      leaveBtn: '🚪 Закончить разговор'
    },
    combat: {
      intro: '{locationName}. Враги преграждают путь!\n\n{enemyList}',
      fightBtn: '⚔️ Вступить в бой',
      fleeBtn: '🏃 Отступить'
    },
    loot_search: {
      intro: 'Вы осматриваете {locationName}, ища что-нибудь ценное.',
      searchBtn: '🔍 Обыскать (проверка {skillLabel}, КС {dc})',
      leaveBtn: '🚪 Уйти'
    }
  };

  function getStrings(data, templateId) {
    const custom = data?.sceneTemplateDefs?.custom?.[templateId]?.strings || {};
    const base = DEFAULT_STRINGS[templateId] || {};
    return Object.assign({}, base, custom);
  }

  function getTemplateMeta(templateId) {
    return BASE_TEMPLATES[templateId] || null;
  }

  function getTemplateIcon(templateId) {
    return BASE_TEMPLATES[templateId]?.icon || '📄';
  }

  function listBaseTemplates() {
    return Object.values(BASE_TEMPLATES);
  }

  function escapeRe(s) {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /** Подстановка {key} в строках шаблона */
  function substitute(str, ctx) {
    if (str == null) return '';
    let out = String(str);
    Object.entries(ctx || {}).forEach(([k, v]) => {
      out = out.replace(new RegExp('\\{' + escapeRe(k) + '\\}', 'g'), v == null ? '' : String(v));
    });
    return out;
  }

  function getNpc(data, npcId) {
    return data?.npcs?.[npcId] || null;
  }

  function getNpcName(data, npcId, fallback) {
    const n = getNpc(data, npcId);
    return n?.name || fallback || npcId || 'Незнакомец';
  }

  function getSceneLabel(data, sceneId) {
    const s = data?.scenes?.[sceneId];
    return s?.location || sceneId || '—';
  }

  /** Разрешить список ID предметов: массив, shopInventories, shopItems NPC */
  function resolveInventory(data, inventoryParam, merchantId) {
    if (Array.isArray(inventoryParam)) return inventoryParam.filter(Boolean);
    const key = String(inventoryParam || '').trim();
    if (!key) {
      const npc = getNpc(data, merchantId);
      if (npc?.shopItems?.length) return [...npc.shopItems];
      return [];
    }
    const inv = data?.shopInventories?.[key];
    if (inv) {
      if (Array.isArray(inv)) return inv;
      if (Array.isArray(inv.items)) return inv.items;
    }
    if (data?.items?.[key]) return [key];
    const npc = getNpc(data, merchantId);
    if (npc?.shopItems?.length) return [...npc.shopItems];
    return [];
  }

  function getItemDisplayName(data, itemId) {
    return data?.items?.[itemId]?.name || itemId;
  }

  function buildItemList(data, itemIds) {
    return itemIds.map((id) => getItemDisplayName(data, id)).join(', ') || '—';
  }

  function hubReturnChoice(exitId) {
    return {
      text: '← Вернуться на площадь',
      to: exitId,
      icon: '🏘️',
      _hubReturn: true
    };
  }

  function applyAudioBg(scene, params) {
    if (params?.bg) {
      scene.bg = params.bg;
      if (!scene.audio) scene.audio = {};
      if (typeof scene.audio === 'string') scene.audio = { ambient: scene.audio };
      scene.audio.bg = params.bg;
    }
  }

  function applyCommonMeta(scene, spec) {
    const id = spec.id || spec.params?.id || 'scene';
    scene.id = id;
    scene.location = spec.name || spec.params?.name || scene.location || id;
    scene.dialogue = scene.dialogue || [];
    scene.flags = scene.flags || {};
    scene.items = scene.items || [];
    scene.gold = scene.gold || 0;
    scene.combat = scene.combat || null;
    scene.sceneTemplate = spec.template;
    scene.templateParams = { ...(spec.params || {}) };
    scene.overrides = spec.overrides || {};
    scene.templateDetached = false;
    return scene;
  }

  function applyOverrides(scene, overrides, data) {
    if (!overrides || typeof overrides !== 'object') return scene;
    const o = overrides;
    if (o.text != null) scene.text = o.text;
    if (o.location != null) scene.location = o.location;
    if (o.greetingText != null) scene.text = o.greetingText;
    if (Array.isArray(o.choices)) scene.choices = o.choices;
    if (o.shopConfig && scene.shopConfig) {
      scene.shopConfig = { ...scene.shopConfig, ...o.shopConfig };
    }
    if (o.customPrices && scene.shopConfig) {
      scene.shopConfig.customPrices = { ...(scene.shopConfig.customPrices || {}), ...o.customPrices };
    }
    if (o.flags) scene.flags = { ...scene.flags, ...o.flags };
    return scene;
  }

  // ——— Генераторы по типам ———

  function generateVillageHub(data, spec) {
    const p = spec.params || {};
    const str = getStrings(data, 'village_hub');
    const locationName = spec.name || p.name || 'Деревня';
    const exit = p.exit || p.exitScene || 'world_map';
    const locations = Array.isArray(p.locations) ? p.locations : [];

    const choices = locations.map((loc) => {
      if (typeof loc === 'string') {
        const sid = loc;
        const label = getSceneLabel(data, sid);
        return { text: label, to: sid, icon: '📍' };
      }
      return {
        text: loc.label || getSceneLabel(data, loc.id || loc.to),
        to: loc.to || loc.id,
        icon: loc.icon || '📍'
      };
    });

    choices.push({
      text: str.rest,
      action: 'rest_short',
      icon: '🛏️'
    });
    if (exit) {
      choices.push({ text: str.exit, to: exit, icon: '🚪' });
    }

    const scene = applyCommonMeta({
      text: substitute(str.intro, { locationName }),
      choices,
      mapLocation: p.mapLocation || spec.id
    }, spec);

    applyAudioBg(scene, p);
    return scene;
  }

  function generateShop(data, spec) {
    const p = spec.params || {};
    const str = getStrings(data, 'shop');
    const merchantId = p.merchant || p.merchantId || 'merchant';
    const merchant = getNpc(data, merchantId);
    const merchantName = getNpcName(data, merchantId, 'Торговец');
    const itemIds = resolveInventory(data, p.inventory, merchantId);
    const exit = p.exit || p.exitScene || 'village_hub';
    const greetingLine = spec.overrides?.greetingLine || merchant?.dialogues?.default?.[0]?.text?.slice(0, 80) || str.greetingLine;

    const scene = applyCommonMeta({
      text: substitute(str.greeting, {
        merchantName,
        greetingLine,
        itemList: buildItemList(data, itemIds)
      }),
      choices: [
        { text: str.talkBtn, to: p.dialogueScene || `${spec.id}_dialogue`, icon: '💬' },
        { text: str.leaveBtn, to: exit, icon: '🚪' }
      ],
      special: 'shop',
      shopConfig: {
        merchant: merchantId,
        inventory: itemIds,
        sellMultiplier: Number(p.sellMultiplier) || 1,
        buyMultiplier: p.buyMultiplier != null ? Number(p.buyMultiplier) : 0.5,
        repFlag: p.repFlag || null,
        exitScene: exit,
        customPrices: { ...(p.customPrices || {}) }
      },
      npcId: merchantId
    }, spec);

    if (p.returnsToHub !== false && exit) {
      scene.returnsToHub = true;
      scene.hubScene = p.hubScene || exit;
    }
    applyAudioBg(scene, p);
    return applyOverrides(scene, spec.overrides, data);
  }

  function generateTavern(data, spec) {
    const p = spec.params || {};
    const str = getStrings(data, 'tavern');
    const innkeeperId = p.innkeeper || p.innkeeperId || 'marta';
    const innkeeperName = getNpcName(data, innkeeperId, 'Хозяин таверны');
    const locationName = spec.name || p.name || 'Таверна';
    const exit = p.exit || p.exitScene || 'village_hub';
    const roomPrice = Math.max(0, parseInt(p.roomPrice, 10) || 5);
    const menuIds = resolveInventory(data, p.menu || p.menuInventory, innkeeperId);

    const choices = [];
    if (menuIds.length) {
      choices.push({ text: str.menuBtn, to: `${spec.id}_menu`, icon: '🍺' });
    }
    choices.push({
      text: substitute(str.roomBtn, { roomPrice }),
      action: 'tavern_rent_room',
      icon: '🛏️',
      once: true,
      flags: { [`${spec.id}_room_rented`]: true },
      showIf: { goldMin: roomPrice }
    });
    choices.push({ text: str.rumorsBtn, to: `${spec.id}_rumors`, icon: '📰' });
    choices.push({ text: str.restBtn, action: 'rest_short', icon: '🛏️' });
    choices.push({ text: str.leaveBtn, to: exit, icon: '🚪', _hubReturn: true });

    const scene = applyCommonMeta({
      text: substitute(str.intro, { locationName, innkeeperName }),
      choices,
      npcId: innkeeperId,
      returnsToHub: true,
      hubScene: p.hubScene || exit,
      tavernConfig: {
        innkeeper: innkeeperId,
        menu: menuIds,
        roomPrice,
        exitScene: exit
      }
    }, spec);

    applyAudioBg(scene, p);
    return applyOverrides(scene, spec.overrides, data);
  }

  /** Дочерние сцены таверны (меню, слухи) */
  function generateTavernChildScenes(data, spec, parentScene) {
    const p = spec.params || {};
    const exit = p.exit || p.exitScene || 'village_hub';
    const menuIds = resolveInventory(data, p.menu || p.menuInventory, p.innkeeper);
    const scenes = {};
    const sid = spec.id;

    if (menuIds.length) {
      scenes[`${sid}_menu`] = applyCommonMeta({
        location: (spec.name || 'Таверна') + ' — меню',
        text: 'На доске меню:\n\n' + buildItemList(data, menuIds) + '\n\nЧто закажете?',
        choices: menuIds.map((itemId) => {
          const price = parentScene?.tavernConfig?.menuPrices?.[itemId]
            || data?.items?.[itemId]?.price
            || 5;
          return {
            text: `🍽 ${getItemDisplayName(data, itemId)} (${price} зм)`,
            to: sid,
            icon: '🍽',
            showIf: { goldMin: price },
            goldCost: price,
            grantItems: [itemId]
          };
        }).concat([{ text: '← Назад', to: sid, icon: '↩️' }]),
        returnsToHub: true,
        hubScene: p.hubScene || exit
      }, { ...spec, id: `${sid}_menu` });
    }

    scenes[`${sid}_rumors`] = applyCommonMeta({
      location: (spec.name || 'Таверна') + ' — слухи',
      text: getNpcName(data, p.innkeeper, 'Хозяин') + ' наклоняется ближе:\n\n«Слыхал, что на мельнице не всё чисто. Дорога в лес опасна — береги кинжал.»',
      choices: [{ text: '← Назад', to: sid, icon: '↩️' }],
      returnsToHub: true,
      hubScene: p.hubScene || exit
    }, { ...spec, id: `${sid}_rumors` });

    return scenes;
  }

  function generateBlacksmith(data, spec) {
    const p = spec.params || {};
    const str = getStrings(data, 'blacksmith');
    const npcId = p.blacksmith || p.blacksmithId || 'blacksmith_npc';
    const exit = p.exit || p.exitScene || 'village_hub';
    const services = p.services || { enhance: true, repair: true };

    const scene = applyCommonMeta({
      text: substitute(str.intro, {
        blacksmithName: getNpcName(data, npcId, 'Кузнец')
      }),
      choices: [],
      special: 'blacksmith',
      exitScene: exit,
      returnsToHub: true,
      hubScene: p.hubScene || exit,
      blacksmithConfig: services,
      npcId: npcId
    }, spec);

    applyAudioBg(scene, p);
    return applyOverrides(scene, spec.overrides, data);
  }

  function generateTemple(data, spec) {
    const p = spec.params || {};
    const str = getStrings(data, 'temple');
    const priestId = p.priest || p.priestId || 'priest';
    const exit = p.exit || p.exitScene || 'village_hub';
    const services = p.services || { heal: true, curse: true, bless: true };
    const healPrice = Math.max(1, parseInt(p.healPrice, 10) || 25);

    const choices = [];
    if (services.heal !== false) {
      choices.push({
        text: substitute(str.healBtn, { healPrice }),
        action: 'temple_heal',
        icon: '✨',
        showIf: { goldMin: healPrice }
      });
    }
    if (services.curse !== false) {
      choices.push({
        text: str.curseBtn,
        to: p.curseScene || 'temple_priest',
        icon: '☦️'
      });
    }
    if (services.bless !== false) {
      choices.push({
        text: str.blessBtn,
        action: 'temple_bless',
        icon: '🙏',
        once: true
      });
    }
    choices.push({ text: str.leaveBtn, to: exit, icon: '🚪', _hubReturn: true });

    const scene = applyCommonMeta({
      text: substitute(str.intro, {
        locationName: spec.name || p.name || 'Храм',
        priestName: getNpcName(data, priestId, 'Священник')
      }),
      choices,
      returnsToHub: true,
      hubScene: p.hubScene || exit,
      templeConfig: { priest: priestId, healPrice, services },
      npcId: priestId
    }, spec);

    applyAudioBg(scene, p);
    return applyOverrides(scene, spec.overrides, data);
  }

  function generateDungeon(data, spec) {
    const p = spec.params || {};
    const str = getStrings(data, 'dungeon');
    const enemies = Array.isArray(p.enemies) ? p.enemies : [];
    const exit = p.exit || p.exitScene || 'village_hub';
    const diff = p.difficulty || p.difficultyLevel || 1;
    const diffLabels = { 1: 'лёгкая', 2: 'средняя', 3: 'опасная', 4: 'смертельная' };

    const scene = applyCommonMeta({
      text: substitute(str.intro, {
        locationName: spec.name || p.name || 'Подземелье',
        difficultyLabel: diffLabels[diff] || `уровень ${diff}`
      }),
      choices: [
        { text: str.enterBtn, to: `${spec.id}_combat`, icon: '⚔️' },
        {
          text: str.trapBtn,
          skillCheck: {
            skill: p.trapSkill || 'perception',
            dc: Math.max(8, parseInt(p.trapDc, 10) || 12 + Number(diff)),
            successText: 'Вы замечаете ловушку и обходите её.',
            failText: 'Ловушка срабатывает! Вы получаете урон.',
            successNext: `${spec.id}_combat`,
            failNext: exit,
            successFlags: { [`${spec.id}_traps_disarmed`]: true }
          },
          icon: '🪤'
        },
        { text: str.leaveBtn, to: exit, icon: '🚪' }
      ],
      dungeonConfig: { enemies, loot: p.loot || [], difficulty: diff }
    }, spec);

    applyAudioBg(scene, p);
    return applyOverrides(scene, spec.overrides, data);
  }

  function generateDungeonCombatScene(data, spec) {
    const p = spec.params || {};
    const enemies = Array.isArray(p.enemies) ? p.enemies : [];
    const win = p.winScene || p.victoryScene || p.exit || 'village_hub';
    const sid = `${spec.id}_combat`;

    return applyCommonMeta({
      location: (spec.name || 'Подземелье') + ' — бой',
      text: 'Из темноты появляются враги!',
      combat: enemies.length ? [...enemies] : null,
      nextScene: win,
      choices: enemies.length ? [] : [{ text: '← Назад', to: spec.id, icon: '↩️' }],
      flags: { [`${spec.id}_entered`]: true }
    }, { ...spec, id: sid });
  }

  function generateDialogue(data, spec) {
    const p = spec.params || {};
    const str = getStrings(data, 'dialogue');
    const npcId = p.npc || p.npcId || 'npc';
    const npcName = getNpcName(data, npcId, 'Собеседник');
    const exit = p.exit || p.exitScene || 'village_hub';
    const topics = Array.isArray(p.topics) ? p.topics : [];

    const choices = topics.map((t, i) => {
      if (typeof t === 'string') {
        return { text: t, to: `${spec.id}_topic_${i}`, icon: '💬' };
      }
      return {
        text: t.label || t.text || `Тема ${i + 1}`,
        to: t.scene || `${spec.id}_topic_${t.id || i}`,
        icon: t.icon || '💬'
      };
    });
    choices.push({ text: str.leaveBtn, to: exit, icon: '🚪' });

    const scene = applyCommonMeta({
      text: substitute(str.greeting, {
        npcName,
        greetingLine: p.greetingLine || str.greetingLine
      }),
      choices,
      npcId: npcId
    }, spec);

    applyAudioBg(scene, p);
    return applyOverrides(scene, spec.overrides, data);
  }

  function generateDialogueTopicScenes(data, spec) {
    const p = spec.params || {};
    const topics = Array.isArray(p.topics) ? p.topics : [];
    const exit = spec.id;
    const scenes = {};

    topics.forEach((t, i) => {
      const tid = typeof t === 'object' ? (t.id || i) : i;
      const sceneId = typeof t === 'object' && t.scene ? t.scene : `${spec.id}_topic_${tid}`;
      const label = typeof t === 'object' ? (t.label || t.text) : t;
      const body = typeof t === 'object' ? (t.reply || t.text || `Ответ по теме «${label}».`) : `Вы говорите о «${t}».`;

      scenes[sceneId] = applyCommonMeta({
        location: (spec.name || 'Разговор') + ' — ' + (label || 'тема'),
        text: body,
        choices: [{ text: '← Вернуться к разговору', to: exit, icon: '↩️' }],
        npcId: p.npc || p.npcId
      }, { ...spec, id: sceneId });
    });

    return scenes;
  }

  function generateCombat(data, spec) {
    const p = spec.params || {};
    const str = getStrings(data, 'combat');
    const enemies = Array.isArray(p.enemies) ? p.enemies : [];
    const enemyList = enemies.map((eid) => data?.enemies?.[eid]?.name || eid).join(', ') || 'противники';
    const win = p.winScene || p.victoryScene || p.exit || 'village_hub';
    const exit = p.exit || p.fleeScene || win;

    const scene = applyCommonMeta({
      text: substitute(str.intro, {
        locationName: spec.name || p.name || 'Поле боя',
        enemyList
      }),
      choices: [
        { text: str.fightBtn, action: 'template_start_combat', icon: '⚔️' },
        { text: str.fleeBtn, to: exit, icon: '🏃' }
      ],
      combat: null,
      nextScene: win,
      templateCombat: {
        enemies: [...enemies],
        loot: p.loot || [],
        winScene: win,
        loseScene: p.loseScene || p.defeatScene || 'game_over'
      }
    }, spec);

    applyAudioBg(scene, p);
    return applyOverrides(scene, spec.overrides, data);
  }

  function generateLootSearch(data, spec) {
    const p = spec.params || {};
    const str = getStrings(data, 'loot_search');
    const exit = p.exit || p.exitScene || 'village_hub';
    const items = Array.isArray(p.items) ? p.items : [];
    const dc = Math.max(5, parseInt(p.dc, 10) || 12);
    const skill = p.skill || 'investigation';
    const skillLabels = {
      perception: 'Восприятие',
      investigation: 'Расследование',
      survival: 'Выживание'
    };

    const scene = applyCommonMeta({
      text: substitute(str.intro, { locationName: spec.name || p.name || 'Место обыска' }),
      choices: [
        {
          text: substitute(str.searchBtn, {
            skillLabel: skillLabels[skill] || skill,
            dc
          }),
          skillCheck: {
            skill,
            dc,
            successText: items.length
              ? 'Вы находите: ' + buildItemList(data, items) + '.'
              : 'Вы ничего ценного не находите.',
            failText: 'Поиск не увенчался успехом.',
            successItems: items,
            successNext: exit,
            failNext: exit,
            successFlags: { [`${spec.id}_searched`]: true }
          },
          icon: '🔍'
        },
        { text: str.leaveBtn, to: exit, icon: '🚪' }
      ],
      lootSearchConfig: { items, dc, skill }
    }, spec);

    applyAudioBg(scene, p);
    return applyOverrides(scene, spec.overrides, data);
  }

  /**
   * Главная функция: сгенерировать объект сцены из шаблона.
   * @param {object} data — game_data
   * @param {object} spec — { template, id, name, params, overrides }
   */
  function generateSceneFromTemplate(data, spec) {
    const templateId = spec?.template || spec?.sceneTemplate;
    if (!templateId || !BASE_TEMPLATES[templateId]) {
      throw new Error('Неизвестный шаблон: ' + templateId);
    }
    spec = {
      template: templateId,
      id: spec.id || spec.params?.id,
      name: spec.name || spec.params?.name,
      params: { ...(spec.params || {}) },
      overrides: spec.overrides || {}
    };
    spec.params.id = spec.id;

    switch (templateId) {
      case 'village_hub':
        return generateVillageHub(data, spec);
      case 'shop':
        return generateShop(data, spec);
      case 'tavern':
        return generateTavern(data, spec);
      case 'blacksmith':
        return generateBlacksmith(data, spec);
      case 'temple':
        return generateTemple(data, spec);
      case 'dungeon':
        return generateDungeon(data, spec);
      case 'dialogue':
        return generateDialogue(data, spec);
      case 'combat':
        return generateCombat(data, spec);
      case 'loot_search':
        return generateLootSearch(data, spec);
      default:
        throw new Error('Шаблон не реализован: ' + templateId);
    }
  }

  /** Дополнительные сцены, создаваемые вместе с основной */
  function generateCompanionScenes(data, spec) {
    const templateId = spec?.template || spec?.sceneTemplate;
    const main = generateSceneFromTemplate(data, spec);
    const extra = {};

    if (templateId === 'tavern') {
      Object.assign(extra, generateTavernChildScenes(data, spec, main));
    }
    if (templateId === 'dungeon') {
      extra[`${spec.id}_combat`] = generateDungeonCombatScene(data, spec);
    }
    if (templateId === 'dialogue') {
      Object.assign(extra, generateDialogueTopicScenes(data, spec));
    }

    return { main, extra };
  }

  /** Развернуть сохранённую сцену с привязкой к шаблону */
  function materializeScene(data, stored) {
    if (!stored?.sceneTemplate || stored.templateDetached) {
      return stored;
    }
    const spec = {
      template: stored.sceneTemplate,
      id: stored.id,
      name: stored.location || stored.templateParams?.name,
      params: { ...(stored.templateParams || {}), id: stored.id },
      overrides: stored.overrides || {}
    };
    let scene;
    try {
      scene = generateSceneFromTemplate(data, spec);
    } catch (e) {
      console.warn('[SceneTemplateEngine]', e);
      return stored;
    }
    scene.sceneTemplate = stored.sceneTemplate;
    scene.templateParams = stored.templateParams;
    scene.templateDetached = false;
    scene.overrides = stored.overrides || {};
    if (stored.mapLocation) scene.mapLocation = stored.mapLocation;
    return applyOverrides(scene, stored.overrides, data);
  }

  function ensureTemplateData(data) {
    if (!data) return;
    if (!data.sceneTemplateDefs) {
      data.sceneTemplateDefs = { custom: {} };
    }
    if (!data.shopInventories) {
      data.shopInventories = {
        village_shop: {
          name: 'Деревенская лавка',
          items: ['healing_potion', 'rope', 'supplies', 'fireball_scroll', 'focus_potion']
        },
        tavern_menu: {
          name: 'Меню таверны',
          items: ['healing_potion', 'water_flask', 'supplies']
        }
      };
    }
  }

  function bindGameEngine() {
    if (typeof GameEngine === 'undefined') return;
    GameEngine.generateSceneFromTemplate = function (spec) {
      return generateSceneFromTemplate(this.data, spec);
    };
  }
  bindGameEngine();
  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', bindGameEngine);
  }

  return {
    BASE_TEMPLATES,
    DEFAULT_STRINGS,
    listBaseTemplates,
    getTemplateMeta,
    getTemplateIcon,
    getStrings,
    substitute,
    resolveInventory,
    generateSceneFromTemplate,
    generateCompanionScenes,
    materializeScene,
    applyOverrides,
    ensureTemplateData
  };
})();

if (typeof window !== 'undefined') {
  window.SceneTemplateEngine = SceneTemplateEngine;
}
