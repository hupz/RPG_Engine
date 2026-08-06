// ============================================================
// Классы и умения — вынесено из editor.html
// ============================================================
(function attachEditorClasses() {
  if (typeof Editor === 'undefined') {
    console.error('editor-classes.js: Editor не определён');
    return;
  }

  Object.assign(Editor, {

      selectClassToEdit(id){ this.editingClassId=id; this.renderClasses(); },

      renderClasses(){ const container=document.getElementById('classes-list'); if(!this.data?.classes){ container.innerHTML='<div class="empty-state"><h2>Нет данных</h2></div>'; return; } const ids=Object.keys(this.data.classes); if(!ids.length){ container.innerHTML='<div class="empty-state"><h2>Нет классов</h2><button class="btn btn-primary" onclick="Editor.createClass()">+ Создать класс</button></div>'; return; } if(!this.editingClassId||!this.data.classes[this.editingClassId]) this.editingClassId=ids[0]; const sidebar=ids.map(id=>{ const cls=this.data.classes[id]; const active=id===this.editingClassId?'active':''; return `<button type="button" class="class-pick ${active}" onclick="Editor.selectClassToEdit('${id}')">${this.renderIcon(cls.icon) || '⚔️'} ${this.escapeHtml(cls.name||id)}</button>`; }).join(''); container.innerHTML=`<div class="class-editor-wrap"><div class="class-editor-sidebar">${sidebar}<button type="button" class="btn btn-primary" style="width:100%;margin-top:10px;" onclick="Editor.createClass()">+ Новый класс</button></div><div class="class-editor-detail">${this.renderClassDetail(this.editingClassId)}</div></div>`; },

      createClass(){
        if (!this.data) { alert('Сначала загрузите проект'); return; }
        if (!this.data.classes) this.data.classes = {};
        let id, name;
        if (typeof this.promptNameAndId === 'function') {
          const r = this.promptNameAndId({
            namePrompt: 'Название класса:',
            defaultName: 'Новый класс',
            existing: this.data.classes,
            allowEditId: false
          });
          if (!r) return;
          id = r.id; name = r.name;
        } else {
          name = prompt('Название класса:', 'Новый класс');
          if (!name) return;
          id = typeof this.slugifyId === 'function'
            ? this.slugifyId(name, '', this.data.classes)
            : ('class_' + Date.now().toString(36));
        }
        if (this.data.classes[id]) {
          id = id + '_' + Date.now().toString(36).slice(-3);
        }
        this.data.classes[id] = {
          name: name || 'Новый класс',
          icon: '⚔️',
          hp: 20, ac: 14, atkBonus: 3, dmgRoll: '1d8', dmgBonus: 2, initBonus: 2,
          stats: { str: 12, dex: 14, con: 12, int: 10, wis: 10, cha: 10 },
          skills: 'Атлетика, Восприятие',
          resource: { name: 'Энергия', max: 2, desc: 'Ресурс для способностей.' },
          mainWeapon: null, startingItems: [],
          abilities: [{
            id: id + '_strike', name: 'Удар', cost: 1, icon: '⚔️',
            desc: 'Базовая атака.', combatOnly: true, oncePerCombat: false,
            effect: { type: 'damage', value: '1d8', damageType: 'physical' }
          }]
        };
        this.editingClassId = id;
        try { this.updateJSONPreview?.(); } catch (e) {}
        this.renderClasses();
      },

      renderClassDetail(id){ const cls=this.data.classes[id]; if(!cls) return ''; if(!cls.stats) cls.stats={str:10,dex:10,con:10,int:10,wis:10,cha:10}; if(!cls.resource) cls.resource={name:'Ресурс',max:2,desc:''}; if(!cls.abilities) cls.abilities=[]; if(!cls.startingItems) cls.startingItems=[]; const weapons=this.getWeaponItems(); const weaponOptions=weapons.map(([wid,w])=>`<option value="${wid}" ${cls.mainWeapon===wid?'selected':''}>${this.escapeHtml(w.name)} (${wid})</option>`).join(''); const itemCheckboxes=this.getAllItemIds().map(itemId=>{ const item=this.data.items[itemId]; const checked=cls.startingItems.includes(itemId)?'checked':''; return `<label style="display:block;font-size:13px;margin:4px 0;"><input type="checkbox" ${checked} onchange="Editor.toggleStartingItem('${id}','${itemId}',this.checked)"> ${this.escapeHtml(item.name)} (${itemId})</label>`; }).join('')||'<p class="hint">Создайте предметы во вкладке «Предметы»</p>'; const globalAbilityOptions=Object.entries(this.data.progression?.abilities||{}).map(([aid,ab])=>`<option value="${this.escapeAttr(aid)}">${this.escapeHtml(ab.icon||'✨')} ${this.escapeHtml(ab.name||aid)}</option>`).join(''); const abilitiesHtml=cls.abilities.map((ab,idx)=>this.renderAbilityEditor(id,ab,idx,cls)).join(''); return `<div class="class-section"><div style="display:flex;justify-content:space-between;"><h4>Основное — ${this.escapeHtml(cls.name)}</h4><button class="btn btn-danger" onclick="Editor.deleteClass('${id}')">🗑 Удалить</button></div><div class="grid-2"><div class="form-group"><label>ID класса</label><input value="${id}" disabled></div><div class="form-group" style="grid-column:1/-1"><label>Иконка</label><div class="icon-picker-row">${this.renderIconEmojiSelect('if(this.value){Editor.updateClass(' + JSON.stringify(id) + ',"icon",this.value);}')}<input type="text" value="${this.escapeHtml(cls.icon||'⚔️')}" onchange="Editor.updateClass('${id}','icon',this.value)">${this.renderIconPreview(cls.icon)}</div><div class="icon-suggestions">${this.renderIconSuggestionButtons(icon => 'Editor.updateClass(' + JSON.stringify(id) + ',"icon",' + JSON.stringify(icon) + ')')}</div><div class="icon-hint">Выберите emoji из списка или вставьте свой / путь к PNG/SVG (например <code>icons/class.png</code>).</div></div></div><div class="form-group"><label>Название</label><input value="${this.escapeHtml(cls.name||'')}" onchange="Editor.updateClass('${id}','name',this.value)"></div></div><div class="class-section"><h4>❤️ Здоровье и защита</h4><div class="grid-3"><div class="form-group"><label>ОЗ</label><input type="number" value="${cls.hp??20}" onchange="Editor.updateClass('${id}','hp',parseInt(this.value)||1)"></div><div class="form-group"><label>КД</label><input type="number" value="${cls.ac??10}" onchange="Editor.updateClass('${id}','ac',parseInt(this.value)||10)"></div><div class="form-group"><label>Инициатива</label><input type="number" value="${cls.initBonus??0}" onchange="Editor.updateClass('${id}','initBonus',parseInt(this.value)||0)"></div></div></div><div class="class-section"><h4>⚡ Ресурс класса</h4><div class="grid-3"><div class="form-group"><label>Название</label><input value="${this.escapeHtml(cls.resource.name)}" onchange="Editor.updateClassResource('${id}','name',this.value)"></div><div class="form-group"><label>Максимум</label><input type="number" value="${cls.resource.max??2}" onchange="Editor.updateClassResource('${id}','max',parseInt(this.value)||0)"></div><div class="form-group"><label>Описание</label><input value="${this.escapeHtml(cls.resource.desc||'')}" onchange="Editor.updateClassResource('${id}','desc',this.value)"></div></div></div><div class="class-section"><h4>📊 Характеристики</h4><div class="grid-6">${['str','dex','con','int','wis','cha'].map(stat=>`<div class="form-group"><label>${stat.toUpperCase()}</label><input type="number" min="1" max="30" value="${cls.stats[stat]??10}" onchange="Editor.updateClassStat('${id}','${stat}',parseInt(this.value)||10)"></div>`).join('')}</div><div class="form-group"><label>Владение навыками</label><input value="${this.escapeHtml(cls.skills||'')}" onchange="Editor.updateClass('${id}','skills',this.value)"></div></div><div class="class-section"><h4>⚔️ Оружие и бой</h4><div class="form-group"><label>Стартовое оружие</label><select onchange="Editor.setClassWeapon('${id}',this.value)"><option value="">— не выбрано —</option>${weaponOptions}</select></div><div class="grid-3"><div class="form-group"><label>Бонус атаки</label><input type="number" value="${cls.atkBonus??0}" onchange="Editor.updateClass('${id}','atkBonus',parseInt(this.value)||0)"></div><div class="form-group"><label>Кубики урона</label><input value="${this.escapeHtml(cls.dmgRoll||'1d6')}" onchange="Editor.updateClass('${id}','dmgRoll',this.value)"></div><div class="form-group"><label>Бонус урона</label><input type="number" value="${cls.dmgBonus??0}" onchange="Editor.updateClass('${id}','dmgBonus',parseInt(this.value)||0)"></div></div><div class="form-group"><label>Звук атаки</label>${this.renderSoundSelect(cls.attackSound||'', `Editor.updateClass('${id}','attackSound',this.value)`)}<div class="hint">Пусто = звук оружия из предмета</div></div></div><div class="class-section"><h4>🎒 Стартовый инвентарь</h4><div style="max-height:160px;overflow-y:auto;border:1px solid var(--border);padding:8px;border-radius:6px;">${itemCheckboxes}</div></div><div class="class-section"><h4>✨ Способности</h4><div class="form-group"><label>Добавить умение из общего пула</label><div style="display:flex;gap:8px;align-items:center;"><select style="flex:1;" onchange="if(this.value){Editor.addGlobalAbilityToClass('${id}',this.value); this.value='';}"><option value="">— Выбрать умение —</option>${globalAbilityOptions}</select><button class="btn btn-secondary" type="button" onclick="Editor.addAbility('${id}')">+ Локальное</button></div></div>${abilitiesHtml}<button class="btn btn-primary" style="margin-top:10px;" onclick="Editor.addAbility('${id}')">+ Добавить способность</button></div>`; },

      renderAbilityEditor(classId, ab, index, cls) {
        // Нормализуем старые строковые эффекты
        if (!ab.effect) ab.effect = {};
        if (typeof ab.effect === 'string') {
          const old = ab.effect;
          ab.effect = {};
          if (old.startsWith('heal:')) { ab.effect.type='heal'; ab.effect.value=old.slice(5); }
          else if (old.startsWith('damage:')) { ab.effect.type='damage'; ab.effect.value=old.slice(7); }
          else if (old==='extra_attack') ab.effect.type='extra_attack';
          else if (old.startsWith('ac_bonus:')) { ab.effect.type='buff'; ab.effect.value=old.slice(9); ab.effect.buffType='ac'; }
          else if (old==='magic_missile') ab.effect.type='magic_missile';
          else if (old.startsWith('aoe_fire:')) { ab.effect.type='damage'; ab.effect.value=old.slice(9); ab.effect.damageType='fire'; ab.effect.targeting={scope:'all_enemies'}; }
          else if (old.startsWith('smite:')) { ab.effect.type='smite'; ab.effect.value=old.slice(6); }
          else ab.effect = { type:'custom', desc:old };
        }
        if (!ab.targeting && ab.effect?.targeting) ab.targeting = ab.effect.targeting;
        if (!ab.targeting) ab.targeting = { scope: 'single' };
        if (!ab.usage) ab.usage = ab.combatOnly ? 'combat' : (ab.combatOnly===false?'exploration':'both');
        if (ab.type !== 'passive') ab.type = 'active';

        const effectTypes = Editor.ABILITY_EFFECT_TYPES || { damage:'Урон', heal:'Лечение', buff:'Бафф', extra_attack:'Доп. атака', magic_missile:'Маг. снаряд', smite:'Кара', detect_magic:'Обнаружение магии', divine_sense:'Божественное чувство', custom:'Особый' };
        const scopeOptions = { single:'Одна цель', area:'Область', all_enemies:'Все враги', ally:'Союзник', self:'На себя' };
        const usageOptions = { combat:'Только бой', exploration:'Только исследование', both:'Любое' };
        const damageTypes = { physical:'Физический', fire:'Огонь', cold:'Холод', lightning:'Молния', radiant:'Излучение', necrotic:'Некротический' };

        return `<div class="ability-edit-card">
          <div class="grid-2"><div class="form-group"><label>ID</label><input value="${this.escapeHtml(ab.id||'')}" placeholder="my_ability" onchange="Editor.updateAbility('${classId}',${index},'id',this.value)"></div><div class="form-group" style="grid-column:1/-1"><label>Иконка</label><div class="icon-picker-row">${this.renderIconEmojiSelect('if(this.value){Editor.setAbilityIcon(' + JSON.stringify(classId) + ',' + index + ',this.value);}')}<input type="text" value="${this.escapeHtml(ab.icon||'✨')}" onchange="Editor.updateAbility('${classId}',${index},'icon',this.value)">${this.renderIconPreview(ab.icon)}</div><div class="icon-suggestions">${this.renderIconSuggestionButtons(icon => 'Editor.setAbilityIcon(' + JSON.stringify(classId) + ',' + index + ',' + JSON.stringify(icon) + ')')}</div><div class="icon-hint">Список emoji, быстрые кнопки ниже или свой текст / путь к PNG/SVG (<code>icons/skill.png</code>).</div></div></div>
          <div class="form-group"><label>Название</label><input value="${this.escapeHtml(ab.name||'')}" onchange="Editor.updateAbility('${classId}',${index},'name',this.value)"></div>
          <div class="form-group"><label>Описание</label><textarea rows="2" onchange="Editor.updateAbility('${classId}',${index},'desc',this.value)">${this.escapeTextarea(ab.desc||'')}</textarea></div>
          ${this.renderAbilitySoundFields('class', classId, ab, index)}
          <div class="grid-3"><div class="form-group"><label>Тип</label><select onchange="Editor.updateAbility('${classId}',${index},'type',this.value)"><option value="active" ${ab.type==='active'?'selected':''}>Активное</option><option value="passive" ${ab.type==='passive'?'selected':''}>Пассивное</option></select></div><div class="form-group"><label>Применение</label><select onchange="Editor.updateAbility('${classId}',${index},'usage',this.value)">${Object.entries(usageOptions).map(([v,l])=>`<option value="${v}" ${ab.usage===v?'selected':''}>${l}</option>`).join('')}</select></div><div class="form-group"><label>Стоимость (${this.escapeHtml(cls.resource?.name||'ресурс')})</label><input type="number" value="${ab.cost??1}" onchange="Editor.updateAbility('${classId}',${index},'cost',parseInt(this.value)||0)"></div></div>
          ${ab.type==='active'?`<div class="form-group"><label>Тип эффекта</label><select onchange="Editor.updateAbilityEffectType('${classId}',${index},this.value)">${Object.entries(effectTypes).map(([v,l])=>`<option value="${v}" ${ab.effect?.type===v?'selected':''}>${l}</option>`).join('')}</select></div>
          ${(ab.effect?.type==='damage'||ab.effect?.type==='heal')?`<div class="grid-2"><div class="form-group"><label>Формула (XdY+Z)</label><input value="${this.escapeHtml(ab.effect.value||'1d6')}" placeholder="2d6+3" onchange="Editor.updateAbilityEffectValue('${classId}',${index},this.value)"></div>${ab.effect?.type==='damage'?`<div class="form-group"><label>Тип урона</label><select onchange="Editor.updateAbilityEffectDamageType('${classId}',${index},this.value)">${Object.entries(damageTypes).map(([v,l])=>`<option value="${v}" ${ab.effect.damageType===v?'selected':''}>${l}</option>`).join('')}</select></div>`:''}</div>`:''}
          ${ab.effect?.type==='buff'?`<div class="grid-2"><div class="form-group"><label>Что усиливает</label><select onchange="Editor.updateAbilityBuffType('${classId}',${index},this.value)"><option value="ac" ${ab.effect.buffType==='ac'?'selected':''}>Класс доспеха</option><option value="atk" ${ab.effect.buffType==='atk'?'selected':''}>Атака</option><option value="dmg" ${ab.effect.buffType==='dmg'?'selected':''}>Урон</option></select></div><div class="form-group"><label>Величина</label><input type="number" value="${ab.effect.value||2}" onchange="Editor.updateAbilityEffectValue('${classId}',${index},this.value)"></div></div>`:''}
          ${Editor.renderEffectTypeExtraFields ? Editor.renderEffectTypeExtraFields(ab.effect, { value: `Editor.updateAbilityEffectValue('${classId}',${index},this.value)`, message: `Editor.updateAbilityEffectMessage('${classId}',${index},this.value)` }) : ''}
          <div class="form-group"><label>Область действия</label><select onchange="Editor.updateAbilityTargeting('${classId}',${index},'scope',this.value)">${Object.entries(scopeOptions).map(([v,l])=>`<option value="${v}" ${(ab.effect?.targeting?.scope||ab.targeting?.scope)==v?'selected':''}>${l}</option>`).join('')}</select></div>
          ${(ab.effect?.targeting?.scope==='area'||ab.targeting?.scope==='area')?`<div class="form-group"><label>Радиус (например: 15ft)</label><input value="${this.escapeHtml((ab.effect?.targeting?.radius||ab.targeting?.radius)||'10ft')}" onchange="Editor.updateAbilityTargeting('${classId}',${index},'radius',this.value)"></div>`:''}
          <div class="form-group"><label>Дальность</label><input value="${this.escapeHtml((ab.effect?.targeting?.range||ab.targeting?.range)||'self')}" placeholder="30ft / self" onchange="Editor.updateAbilityTargeting('${classId}',${index},'range',this.value)"></div>
          <div class="form-group"><label><input type="checkbox" id="hasSave-${classId}-${index}" ${ab.effect?.savingThrow?'checked':''} onchange="Editor.toggleSavingThrow('${classId}',${index},this.checked)"> Цель совершает спасбросок</label></div>
          <div id="saveBlock-${classId}-${index}" style="${ab.effect?.savingThrow?'':'display:none;'}"><div class="grid-2"><div class="form-group"><label>Навык спасброска</label><select onchange="Editor.updateAbilitySave('${classId}',${index},'skill',this.value)"><option value="strength" ${ab.effect?.savingThrow?.skill==='strength'?'selected':''}>Сила</option><option value="dexterity" ${ab.effect?.savingThrow?.skill==='dexterity'?'selected':''}>Ловкость</option><option value="constitution" ${ab.effect?.savingThrow?.skill==='constitution'?'selected':''}>Телосложение</option><option value="intelligence" ${ab.effect?.savingThrow?.skill==='intelligence'?'selected':''}>Интеллект</option><option value="wisdom" ${ab.effect?.savingThrow?.skill==='wisdom'?'selected':''}>Мудрость</option><option value="charisma" ${ab.effect?.savingThrow?.skill==='charisma'?'selected':''}>Харизма</option></select></div><div class="form-group"><label>Сложность (DC)</label><input type="number" value="${ab.effect?.savingThrow?.dc||13}" onchange="Editor.updateAbilitySave('${classId}',${index},'dc',parseInt(this.value))"></div></div><div class="form-group"><label><input type="checkbox" ${ab.effect?.savingThrow?.halfOnSave?'checked':''} onchange="Editor.updateAbilitySave('${classId}',${index},'halfOnSave',this.checked)"> Половина урона при успехе</label></div></div>
          `:''}
          ${ab.type==='passive'?`<div class="form-group"><label>Пассивный эффект (JSON)</label><textarea rows="2" onchange="Editor.updateAbilityPassive('${classId}',${index},this.value)">${JSON.stringify(ab.passive||{})}</textarea><div class="hint">Пример: {"maxHpBonus":6, "acBonus":2, "atkBonus":1, "resourceMaxBonus":1}</div></div>`:''}
          <div style="margin-top:10px;"><label><input type="checkbox" ${ab.oncePerCombat?'checked':''} onchange="Editor.updateAbility('${classId}',${index},'oncePerCombat',this.checked)"> Один раз за бой</label></div>
          <button class="btn btn-danger" style="margin-top:10px;" onclick="Editor.deleteAbility('${classId}',${index})">🗑 Удалить способность</button>
        </div>`;
      },

      addAbility(classId){ if(!this.data.classes[classId].abilities)this.data.classes[classId].abilities=[]; const n=this.data.classes[classId].abilities.length+1; this.data.classes[classId].abilities.push({id:classId+'_skill_'+n,name:'Новая способность',cost:1,icon:'✨',desc:'Описание...',combatOnly:true,oncePerCombat:false,effect:{type:'damage',value:'1d6',damageType:'physical'}}); this.renderClasses(); this.updateJSONPreview(); },

      updateAbility(classId, idx, field, value){ this.data.classes[classId].abilities[idx][field]=value; this.updateJSONPreview(); if(field==='name'||field==='icon') this.renderClasses(); },

      deleteAbility(classId, idx){ if(!confirm('Удалить способность?'))return; this.data.classes[classId].abilities.splice(idx,1); this.renderClasses(); this.updateJSONPreview(); },

      deleteClass(id){ if(!confirm('Удалить класс?'))return; delete this.data.classes[id]; this.editingClassId=Object.keys(this.data.classes)[0]||null; this.renderClasses(); this.updateJSONPreview(); },

      updateAbilityEffectValue(classId, idx, value){ const ab=this.data.classes[classId].abilities[idx]; ab.effect.value=value; this.updateJSONPreview(); },

      updateAbilityEffectType(classId, idx, type){ const ab=this.data.classes[classId].abilities[idx]; if(!ab.effect)ab.effect={}; if(Editor.applyAbilityEffectDefaults) Editor.applyAbilityEffectDefaults(ab.effect,type); else { ab.effect.type=type; if(type==='damage'){ab.effect.value='2d6';ab.effect.damageType='fire';} if(type==='heal')ab.effect.value='1d8+2'; if(type==='buff'){ab.effect.buffType='ac';ab.effect.value=2;} delete ab.effect.savingThrow; } this.renderClasses(); this.updateJSONPreview(); },

      updateAbilityEffectDamageType(classId, idx, dt){ const ab=this.data.classes[classId].abilities[idx]; ab.effect.damageType=dt; this.updateJSONPreview(); },

      updateAbilityTargeting(classId, idx, field, value){ const ab=this.data.classes[classId].abilities[idx]; if(!ab.effect)ab.effect={}; if(!ab.effect.targeting)ab.effect.targeting={scope:'single'}; ab.effect.targeting[field]=value; this.updateJSONPreview(); },

      updateAbilitySave(classId, idx, field, value){ const ab=this.data.classes[classId].abilities[idx]; if(!ab.effect.savingThrow)ab.effect.savingThrow={}; ab.effect.savingThrow[field]=value; this.updateJSONPreview(); },

      setAbilityIcon(classId, idx, icon) {
        if (!this.data?.classes?.[classId]?.abilities?.[idx]) return;
        this.data.classes[classId].abilities[idx].icon = icon;
        this.renderClasses();
        this.updateJSONPreview();
      }
  });

  if (typeof Editor.hooks?.rebind === 'function') {
    Editor.hooks.rebind('renderClasses');
    Editor.hooks.rebind('renderClassDetail');
    Editor.hooks.rebind('createClass');
  }
})();
