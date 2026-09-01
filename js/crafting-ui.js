/**
 * Глобальный UI крафта (dock-панель panel-crafting).
 * Сценовый CraftPanel не затрагивается.
 */
const CraftingUI = {
  init() {
    if (this._inited) return;
    this._inited = true;
    document.addEventListener('DOMContentLoaded', () => {
      if (typeof GameEngine !== 'undefined') GameEngine.migrateCraftingState?.();
    });
  },

  renderIfOpen() {
    if (typeof SidebarDock !== 'undefined' && SidebarDock.activePanel === 'crafting') {
      this.render();
    }
  },

  render() {
    const box = document.getElementById('crafting-recipes-list');
    const engine = typeof GameEngine !== 'undefined' ? GameEngine : null;
    if (!box || !engine?.data) {
      if (box) box.innerHTML = '<p class="hint">Крафт недоступен.</p>';
      return;
    }

    engine.migrateCraftingState?.();
    const recipes = engine.getAllRecipes();
    if (!recipes.length) {
      box.innerHTML = '<p class="hint">Нет рецептов в данных (recipes).</p>';
      return;
    }

    const esc = (s) => (engine.escapeHtml ? engine.escapeHtml(s) : String(s ?? ''));
    const attr = (s) => (engine.escapeAttr ? engine.escapeAttr(s) : String(s ?? ''));

    let html = '';
    recipes.forEach((recipe) => {
      const id = recipe.id;
      const known = engine.isRecipeKnown(id);
      const canCraft = known && engine.canCraftRecipe(id);
      const rowClass = !known
        ? 'craft-recipe-row craft-recipe-row--unknown'
        : canCraft
          ? 'craft-recipe-row craft-recipe-row--ok'
          : 'craft-recipe-row craft-recipe-row--fail';

      const ingLines = (recipe.ingredients || []).map((ing) => {
        const itemId = ing.id || ing.itemId;
        const need = Math.max(1, parseInt(ing.quantity, 10) || 1);
        const have = engine.countInventoryItem(itemId);
        const db = engine.data?.items?.[itemId];
        const name = db?.name || itemId;
        const ok = have >= need;
        return `<span class="craft-ing${ok ? ' craft-ing--ok' : ' craft-ing--miss'}">${esc(db?.icon || '📦')} ${esc(name)} ${have}/${need}</span>`;
      }).join('');

      const resultId = recipe.result?.itemId || recipe.result?.id;
      const resultDb = resultId ? engine.data?.items?.[resultId] : null;
      const resultQty = Math.max(1, parseInt(recipe.result?.quantity, 10) || 1);
      const resultLabel = resultDb
        ? `${resultDb.icon || '📦'} ${resultDb.name}${resultQty > 1 ? ` ×${resultQty}` : ''}`
        : resultId || '—';

      const cat = recipe.category ? `<span class="craft-recipe-cat">${esc(recipe.category)}</span>` : '';
      const btn = known
        ? `<button type="button" class="choice craft-recipe-btn" ${canCraft ? '' : 'disabled'}
            onclick="CraftingUI.onCraftClick('${attr(id)}')">Создать</button>`
        : '<span class="hint">Рецепт неизучен</span>';

      html += `<div class="${rowClass}" data-recipe-id="${attr(id)}">
        <div class="craft-recipe-head">
          <span class="craft-recipe-icon">${esc(recipe.icon || '🔨')}</span>
          <span class="craft-recipe-name">${esc(recipe.name || id)}</span>
          ${cat}
        </div>
        <div class="craft-recipe-ing">${ingLines || '<span class="hint">—</span>'}</div>
        <div class="craft-recipe-result">→ ${esc(resultLabel)}</div>
        <div class="craft-recipe-actions">${btn}</div>
      </div>`;
    });

    box.innerHTML = html;
  },

  renderCraftable() {
    const all = GameEngine?.getAllRecipes?.() || [];
    return all.filter((r) => GameEngine.canCraftRecipe(r.id));
  },

  async onCraftClick(recipeId) {
    if (!recipeId || typeof GameEngine === 'undefined') return;
    const res = await GameEngine.craft(recipeId);
    if (res && res.success === false) {
      const msg = res.error === 'no_materials' || res.error === 'recipe_unknown'
        ? '❌ Нельзя создать этот предмет.'
        : '❌ Крафт не удался.';
      GameEngine.log?.(msg, 'log-damage');
    }
    GameEngine.refreshSceneComponents?.();
    GameEngine.updateStats?.();
    this.render();
  }
};

CraftingUI.init();

if (typeof window !== 'undefined') {
  window.CraftingUI = CraftingUI;
}
