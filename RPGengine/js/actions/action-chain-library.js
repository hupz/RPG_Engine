// ============================================
// Библиотека готовых цепочек действий (примеры)
// ============================================

const DEFAULT_ACTION_CHAINS = {
  not_enough_gold: {
    name: 'Недостаточно золота',
    steps: [
      { action: 'log', params: { message: '❌ Недостаточно золота.', type: 'danger' } }
    ]
  },

  buy_potion: {
    name: 'Купить зелье лечения',
    steps: [
      { action: 'check_gold', params: { amount: 20 }, onFail: 'not_enough_gold' },
      { action: 'remove_gold', params: { amount: 20 } },
      { action: 'add_item', params: { itemId: 'healing_potion', count: 1 } },
      { action: 'log', params: { message: '✅ Куплено зелье лечения!', type: 'success' } },
      { action: 'refresh_ui' }
    ]
  },

  buy_item: {
    name: 'Купить предмет (шаблон)',
    steps: [
      { action: 'check_gold', params: { amount: 50 }, onFail: 'not_enough_gold' },
      { action: 'remove_gold', params: { amount: 50 } },
      { action: 'add_item', params: { itemId: 'healing_potion', count: 1 } },
      { action: 'log', params: { message: 'Покупка завершена.', type: 'success' } }
    ]
  },

  sell_item: {
    name: 'Продать предмет (шаблон)',
    steps: [
      { action: 'check_item', params: { itemId: 'rope', count: 1 }, onFail: 'no_item_to_sell' },
      { action: 'remove_item', params: { itemId: 'rope', count: 1 } },
      { action: 'add_gold', params: { amount: 5 } },
      { action: 'log', params: { message: '💰 Предмет продан.', type: 'success' } }
    ]
  },

  no_item_to_sell: {
    name: 'Нет предмета для продажи',
    steps: [
      { action: 'log', params: { message: 'У вас нет такого предмета.', type: 'warning' } }
    ]
  },

  heal_at_temple: {
    name: 'Лечение в храме',
    steps: [
      { action: 'check_gold', params: { amount: 50 }, onFail: 'not_enough_gold' },
      { action: 'remove_gold', params: { amount: 50 } },
      { action: 'heal', params: { target: 'self', amount: '2d8+4', restoreResources: true } },
      { action: 'log', params: { message: '✨ Священник исцелил ваши раны.', type: 'success' } },
      { action: 'refresh_ui' }
    ]
  },

  heal_party: {
    name: 'Лечение группы',
    steps: [
      { action: 'heal', params: { target: 'party', amount: '2d6+2' } },
      { action: 'log', params: { message: 'Группа отдыхает и восстанавливает силы.', type: 'heal' } }
    ]
  },

  remove_curse: {
    name: 'Снятие проклятия',
    steps: [
      { action: 'check_gold', params: { amount: 200 }, onFail: 'not_enough_gold' },
      { action: 'remove_gold', params: { amount: 200 } },
      { action: 'remove_effect', params: { target: 'self', effect: 'cursed' } },
      { action: 'log', params: { message: '✨ Проклятие ослаблено священником.', type: 'success' } }
    ]
  },

  start_quest: {
    name: 'Начать квест',
    steps: [
      { action: 'say', params: { npcId: 'marta', text: 'Помоги найти моего сына! Возьми это фото.' } },
      { action: 'set_flag', params: { flag: 'quest_find_son', value: true } },
      { action: 'update_quest', params: { questId: 'find_albert', stage: '1' } },
      { action: 'log', params: { message: '📜 Новое задание: найти сына Марты.', type: 'success' } }
    ]
  },

  complete_quest: {
    name: 'Завершить квест',
    steps: [
      { action: 'update_quest', params: { questId: 'find_albert', stage: 'complete' } },
      { action: 'add_gold', params: { amount: 100 } },
      { action: 'log', params: { message: '🎉 Квест выполнен! +100 зм', type: 'success' } }
    ]
  },

  enhance_item: {
    name: 'Заточка (упрощённо)',
    steps: [
      { action: 'check_gold', params: { amount: 100 }, onFail: 'not_enough_gold' },
      { action: 'remove_gold', params: { amount: 100 } },
      { action: 'log', params: { message: '⚒️ Кузнец закалил ваше снаряжение!', type: 'success' } }
    ]
  },

  gamble_dice: {
    name: 'Азартная игра (кости)',
    steps: [
      { action: 'check_gold', params: { amount: 10 }, onFail: 'not_enough_gold' },
      { action: 'remove_gold', params: { amount: 10 } },
      {
        action: 'roll_check',
        params: { dc: 15 },
        onSuccess: [
          { action: 'add_gold', params: { amount: 25 } },
          { action: 'log', params: { message: '🎲 Удача! Вы выиграли 25 зм.', type: 'success' } }
        ],
        onFail: [
          { action: 'log', params: { message: '🎲 Неудача. Ставка потеряна.', type: 'warning' } }
        ]
      }
    ]
  },

  jack_greeting: {
    name: 'Приветствие Джека',
    steps: [
      {
        action: 'say',
        params: {
          npcId: 'jack',
          text: 'Добро пожаловать! Видишь кнопки — покупай быстро, или торгуйся как обычно.'
        }
      }
    ]
  },

  npc_dialogue: {
    name: 'Диалог с ветвлением',
    steps: [
      {
        action: 'check_gold',
        params: { amount: 100 },
        onSuccess: [
          { action: 'say', params: { npcId: 'jack', text: 'У тебя достаточно золота!' } },
          {
            action: 'show_choices',
            params: {
              choices: [
                { text: 'Купить зелье', chain: 'buy_potion' },
                { text: 'Уйти', to: 'village_hub' }
              ]
            }
          }
        ],
        onFail: [
          { action: 'say', params: { npcId: 'jack', text: 'Приходи, когда разбогатеешь.' } },
          { action: 'change_scene', params: { sceneId: 'village_hub' } }
        ]
      }
    ]
  },

  trap_disarm: {
    name: 'Обезвреживание ловушки',
    steps: [
      {
        action: 'check_skill',
        params: { skill: 'investigation', dc: 14 },
        onSuccess: [
          { action: 'log', params: { message: '✅ Ловушка обезврежена!', type: 'success' } },
          { action: 'set_flag', params: { flag: 'trap_disarmed', value: true } }
        ],
        onFail: [
          { action: 'damage', params: { target: 'self', amount: '1d6' } },
          { action: 'log', params: { message: '💥 Ловушка сработала!', type: 'danger' } }
        ]
      }
    ]
  },

  leave_shop: {
    name: 'Уйти из лавки',
    steps: [
      { action: 'change_scene', params: { sceneId: 'village_hub' } }
    ]
  }
};

const ActionChainLibrary = {
  ensureActionChains(data) {
    if (!data) return;
    if (!data.actionChains) data.actionChains = {};
    Object.keys(DEFAULT_ACTION_CHAINS).forEach((id) => {
      if (!data.actionChains[id]) {
        data.actionChains[id] = JSON.parse(JSON.stringify(DEFAULT_ACTION_CHAINS[id]));
      }
    });
  },

  getDefaults() {
    return DEFAULT_ACTION_CHAINS;
  }
};

if (typeof window !== 'undefined') {
  window.DEFAULT_ACTION_CHAINS = DEFAULT_ACTION_CHAINS;
  window.ActionChainLibrary = ActionChainLibrary;
}
