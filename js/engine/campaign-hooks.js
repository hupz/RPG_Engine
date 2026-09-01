// ============================================================
// Campaign-specific content hooks (Мельница / demo)
// Quest IDs live here, not in generic ui-renderer.
// ============================================================
(function attachCampaignHooks() {
  'use strict';
  if (typeof GameEngine === 'undefined') return;

  Object.assign(GameEngine, {
    /**
     * Claim find_albert reward (content). Uses generic applyQuestRewards + updateQuest.
     */
    claimFindAlbertReward() {
      if (this.state.flags.find_albert_rewardClaimed) return false;
      if (!this.state.flags.albertSaved) return false;
      if (!this.applyQuestRewards('find_albert', {
        claimFlag: 'find_albert_rewardClaimed',
        logGold: 'награда от Марты'
      })) {
        return false;
      }
      this.state.flags.albertAtVillage = true;
      this.updateQuest('find_albert', 'complete');
      this.updateStats();
      this.saveGame();
      return true;
    },

    handleEpilogueAlbertArrival() {
      this.state.flags.albertEscorted = true;
      this.state.flags.albertAtVillage = true;
      if (!this.state.flags.find_albert_rewardClaimed) {
        this.claimFindAlbertReward();
      }
    },

    handleMartaFindAlbertReward() {
      this.setLocation('Таверна «Кривой Котёл»');
      const claimed = this.claimFindAlbertReward();
      if (claimed) {
        this.setText(
          'Марта обнимает Альберта, потом крепко жмёт вам руки.\n\n«Ты не просто спас мельника — ты спас всю деревню. Держи награду — и знай: дверь таверны всегда открыта для тебя.»'
        );
        this.setDialogue([
          { speaker: 'Марта', text: 'Пятьдесят золотых — и моя благодарность. Альберт уже отдыхает у камина.' },
          { speaker: 'Альберт', text: 'Спасибо, ' + (this.state.charName || 'друг') + '. Без тебя я бы не выбрался.' }
        ]);
      } else {
        this.setText('Марта улыбается: «Награда уже вручена, но благодарность наша не кончается.»');
        this.clearDialogue();
      }
      const sideQuestChoices = this.getAlbertSideQuestChoices();
      this.setChoices([
        ...sideQuestChoices,
        { text: '← В таверну', to: 'tavern' },
        { text: '🏘️ На площадь', to: 'village_hub' }
      ]);
    },

    getAlbertSideQuestChoices() {
      const ctx = this.getConditionContext();
      const raw = [
        {
          text: '🗣️ Спросить Альберта о письме Люкорна',
          to: 'albert_lukorn_talk',
          questSet: { questId: 'lukorn_investigation', stage: '0' },
          showIf: {
            all: [
              { flag: 'albertSaved', equals: true },
              { notHasItem: 'lukorn_signet_ring' },
              { flag: 'lukorn_investigation_started', equals: false }
            ]
          }
        },
        {
          text: '🗣️ Поговорить с Альбертом о медальоне Эльзы',
          to: 'albert_locket_talk',
          showIf: {
            all: [
              { flag: 'albertSaved', equals: true },
              { notHasItem: 'elsa_locket' },
              { flag: 'albert_locket_started', equals: false }
            ]
          }
        }
      ];
      if (typeof ConditionSystem === 'undefined') return raw;
      return raw.filter((c) => ConditionSystem.isChoiceVisible(c, ctx));
    },

    /** Extra shop action buttons for jackShop (item/flag driven, not quest-id in renderer). */
    renderJackShopQuestButtons(cfg) {
      if (!cfg?.jackShop) return '';
      let html = '';
      if (!this.state.flags.jackQuest) {
        html += `<button type="button" class="choice shop-action-btn" onclick="GameEngine.openJackQuestTalk()">🗣️ О пропавшей сумке</button>`;
      }
      if (
        this.state.inventory.includes('jack_bag') &&
        this.state.flags.jackQuest &&
        !this.state.flags.jackRewarded
      ) {
        html += `<button type="button" class="choice shop-action-btn" onclick="GameEngine.showScene('jack_reward')">🎒 Вернуть сумку</button>`;
      }
      return html;
    }
  });
})();
