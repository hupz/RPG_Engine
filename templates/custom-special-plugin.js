// ============================================
// Шаблон кастомных special-сцен (Plugin API)
// ============================================
// Подключите этот файл ПОСЛЕ js/special-scenes.js
// <script src="js/special-scenes.js"></script>
// <script src="templates/custom-special-plugin.js"></script>

// -------------------------------------------
// Пример 1: Мини-игра в кости
// -------------------------------------------
SpecialSceneRegistry.register('dice_game', 'Мини-игра в кости', function(engine, sceneId, scene) {
  const bet = 10;
  const gold = engine.state.gold || 0;

  engine.setText('Трактирщик достаёт пару костей и улыбается.\n\n«Ставка — ' + bet + ' золотых. Кто выбросит больше — тот и выиграл.»');
  engine.setDialogue([
    { speaker: 'Трактирщик', text: 'Ну что, рискнёшь?' }
  ]);

  const choices = [];
  if (gold >= bet) {
    choices.push({
      text: '🎲 Играть (' + bet + ' зм)',
      to: 'dice_game_roll'
    });
  } else {
    choices.push({
      text: '💰 Недостаточно золота (нужно ' + bet + ')',
      to: sceneId  // Остаёмся на месте
    });
  }
  choices.push({ text: '← Отказаться', to: 'tavern' });
  engine.setChoices(choices);
});

// Сцена результата броска (должна существовать в game_data.json)
// Создайте сцену dice_game_roll с special: dice_game_result
SpecialSceneRegistry.register('dice_game_result', 'Результат игры в кости', function(engine, sceneId, scene) {
  const bet = 10;
  const playerRoll = engine.d(6) + engine.d(6);
  const npcRoll = engine.d(6) + engine.d(6);

  engine.state.gold -= bet;

  let resultText, reward;
  if (playerRoll > npcRoll) {
    reward = bet * 2;
    engine.state.gold += reward;
    resultText = 'Вы выбросили ' + playerRoll + ', трактирщик — ' + npcRoll + '. Победа! +' + reward + ' зм.';
    engine.log('🎲 Кости: ' + playerRoll + ' vs ' + npcRoll + ' — победа! +' + reward + ' зм', 'log-heal');
  } else if (playerRoll === npcRoll) {
    engine.state.gold += bet;
    resultText = 'Ничья (' + playerRoll + '). Ставки возвращены.';
    engine.log('🎲 Кости: ' + playerRoll + ' vs ' + npcRoll + ' — ничья', 'log-dice');
  } else {
    resultText = 'Вы выбросили ' + playerRoll + ', трактирщик — ' + npcRoll + '. Проигрыш.';
    engine.log('🎲 Кости: ' + playerRoll + ' vs ' + npcRoll + ' — проигрыш', 'log-damage');
  }

  engine.setText(resultText);
  engine.clearDialogue();
  engine.setChoices([
    { text: '🎲 Сыграть ещё', to: 'dice_game' },
    { text: '← Уйти', to: 'tavern' }
  ]);
  engine.updateStats();
  engine.saveGame();
});

// -------------------------------------------
// Пример 2: Алхимическая станция
// -------------------------------------------
SpecialSceneRegistry.register('alchemy_station', 'Алхимическая станция', function(engine, sceneId, scene) {
  const gold = engine.state.gold || 0;
  const inv = engine.state.inventory || [];
  const hasHerb = inv.includes('herb');
  const hasVial = inv.includes('empty_vial');
  const canCraft = hasHerb && hasVial && gold >= 5;

  let desc = 'Старый алхимический стол покрыт пылью. Колбы и реагенты.';
  if (hasHerb) desc += '\n\nУ вас есть лечебные травы.';
  if (hasVial) desc += '\nЕсть пустой флакон.';

  engine.setText(desc);
  engine.setDialogue([
    { speaker: 'Алхимик', text: canCraft
      ? 'Вижу ингредиенты. Зелье лечения — 5 золотых.'
      : 'Приходите, когда будут травы, флакон и монеты.' }
  ]);

  const choices = [];
  if (canCraft) {
    choices.push({
      text: '🧪 Сварить зелье лечения (5 зм)',
      to: 'alchemy_craft_result'
    });
  }
  choices.push({ text: '← Уйти', to: 'village' });
  engine.setChoices(choices);
});

// Сцена крафта (должна существовать в game_data.json)
SpecialSceneRegistry.register('alchemy_craft_result', 'Результат алхимии', function(engine, sceneId, scene) {
  engine.state.gold -= 5;
  engine.removeItem('herb');
  engine.removeItem('empty_vial');
  engine.addItem('healing_potion');

  engine.setText('Жидкость во флаконе приобретает рубиновый оттенок. Зелье лечения готово!');
  engine.clearDialogue();
  engine.setChoices([
    { text: '🧪 Сварить ещё', to: 'alchemy_station' },
    { text: '← Уйти', to: 'village' }
  ]);
  engine.updateStats();
  engine.saveGame();
  engine.log('🧪 Сварено зелье лечения', 'log-heal');
});

// -------------------------------------------
// Пример 3: Динамический торговец (цены от репутации)
// -------------------------------------------
SpecialSceneRegistry.register('dynamic_merchant', 'Динамический торговец', function(engine, sceneId, scene) {
  const rep = engine.state.flags?.rep_village || 0;
  const multiplier = Math.max(0.7, Math.min(1.5, 1 - rep / 100));

  const basePrices = { healing_potion: 20, rope: 10, supplies: 10 };
  const prices = {};
  for (const [item, base] of Object.entries(basePrices)) {
    prices[item] = Math.max(1, Math.ceil(base * multiplier));
  }

  const discountText = rep > 10
    ? '(скидка ' + Math.round((1 - multiplier) * 100) + '%)'
    : rep < -10
      ? '(наценка ' + Math.round((multiplier - 1) * 100) + '%)'
      : '';

  engine.setText('Странствующий торговец раскладывает товары.\n\n«Цены честные' + discountText + '.»');
  engine.clearDialogue();

  const gold = engine.state.gold || 0;
  const choices = [];

  const items = [
    { id: 'healing_potion', name: 'Зелье лечения' },
    { id: 'rope', name: 'Верёвка' },
    { id: 'supplies', name: 'Припасы' }
  ];

  items.forEach(item => {
    const price = prices[item.id];
    const canBuy = gold >= price;
    choices.push({
      text: (canBuy ? '💰 ' : '❌ ') + item.name + ' (' + price + ' зм)',
      to: canBuy ? 'merchant_buy_' + item.id : sceneId
    });
  });

  choices.push({ text: '← Уйти', to: 'village' });
  engine.setChoices(choices);
});

console.log('[custom-special-plugin] Registered: dice_game, dice_game_result, alchemy_station, alchemy_craft_result, dynamic_merchant');
