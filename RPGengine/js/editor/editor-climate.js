// Редактор: климат, сезоны, погода по сценам
(function attachEditorClimate() {
  if (typeof Editor === 'undefined') return;

  const SEASON_IDS = ['spring', 'summer', 'autumn', 'winter'];
  const SEASON_LABELS = { spring: '🌸 Весна', summer: '☀️ Лето', autumn: '🍂 Осень', winter: '❄️ Зима' };
  const PERIOD_IDS = ['dawn', 'day', 'dusk', 'night'];
  const PERIOD_LABELS = { dawn: 'Рассвет', day: 'День', dusk: 'Сумерки', night: 'Ночь' };
  const WEATHER_KEYS = ['clear', 'cloudy', 'rain', 'fog', 'snow', 'blizzard', 'thunderstorm', 'hot', 'drought', 'storm', 'ice'];
  const WEATHER_VARIANT_KEYS = ['rain', 'light_rain', 'heavy_rain', 'snow', 'light_snow', 'thunderstorm', 'blizzard', 'fog'];

  Editor.ensureClimateSettings = function () {
    if (!this.data.settings) this.data.settings = {};
    const s = this.data.settings;
    if (!s.timeScale || typeof s.timeScale !== 'object') {
      s.timeScale = { realMinutesPerGameHour: 3, startHour: 8, startDay: 1, enabled: true };
    }
    if (!s.climate || typeof s.climate !== 'object') {
      s.climate = {
        enabled: true,
        startDate: { month: 3, day: 15, year: 4720 },
        seasons: {},
        regions: {
          default: {
            baseTemp: 0,
            weights: {
              spring: { clear: 30, cloudy: 30, rain: 25, fog: 15 },
              summer: { clear: 40, hot: 20, rain: 20, thunderstorm: 15, drought: 5 },
              autumn: { rain: 25, cloudy: 30, clear: 20, fog: 15, storm: 10 },
              winter: { snow: 30, blizzard: 10, clear: 20, cloudy: 20, ice: 20 }
            }
          }
        }
      };
    }
    if (!s.climate.regions) s.climate.regions = { default: { baseTemp: 0, weights: {} } };
    if (!s.climate.regions.default) s.climate.regions.default = { baseTemp: 0, weights: {} };
    return s.climate;
  };

  Editor.ensureSceneClimate = function (sceneId) {
    const scene = this.data?.scenes?.[sceneId];
    if (!scene) return null;
    if (!scene.climate || typeof scene.climate !== 'object') scene.climate = {};
    return scene.climate;
  };

  Editor.renderClimateTab = function () {
    const el = document.getElementById('climate-editor');
    if (!el || !this.data) {
      if (el) el.innerHTML = '<div class="empty-state"><h2>Загрузите данные</h2></div>';
      return;
    }
    const climate = this.ensureClimateSettings();
    const ts = this.ensureTimeSettings?.() || this.data.settings.timeScale || {};
    const regions = climate.regions || {};
    const regionIds = Object.keys(regions);

    el.innerHTML = `<div class="climate-editor-wrap">
      <h3>🌍 Климат и погода</h3>
      <label style="display:block;margin:8px 0;">
        <input type="checkbox" ${climate.enabled !== false ? 'checked' : ''}
          onchange="Editor.setClimateSetting('enabled', this.checked)"> Включить сезоны и погоду
      </label>

      <div class="climate-section project-info">
        <h4>⏰ Время</h4>
        <div class="grid-2">
          <div class="form-group">
            <label>1 игровой час = реальных минут</label>
            <input type="number" min="1" max="120" value="${ts.realMinutesPerGameHour ?? 3}"
              onchange="Editor.updateTimeSetting('realMinutesPerGameHour', parseFloat(this.value)||3)">
          </div>
          <div class="form-group">
            <label>Начальный час (0–23)</label>
            <input type="number" min="0" max="23" value="${ts.startHour ?? 8}"
              onchange="Editor.updateTimeSetting('startHour', parseInt(this.value,10)||8)">
          </div>
        </div>
        <div class="grid-3">
          <div class="form-group">
            <label>Начальный месяц</label>
            <select onchange="Editor.setClimateStartDate('month', parseInt(this.value,10))">
              ${[1,2,3,4,5,6,7,8,9,10,11,12].map(m => `<option value="${m}" ${(climate.startDate?.month ?? 3) === m ? 'selected' : ''}>${m}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>День (1–30)</label>
            <input type="number" min="1" max="30" value="${climate.startDate?.day ?? 15}"
              onchange="Editor.setClimateStartDate('day', parseInt(this.value,10)||15)">
          </div>
          <div class="form-group">
            <label>Год</label>
            <input type="number" value="${climate.startDate?.year ?? 4720}"
              onchange="Editor.setClimateStartDate('year', parseInt(this.value,10)||4720)">
          </div>
        </div>
      </div>

      <div class="climate-section project-info">
        <h4>🍂 Длина дня по сезонам</h4>
        ${SEASON_IDS.map(sid => {
          const ov = climate.seasons?.[sid]?.dayLength || {};
          const defs = { spring: { dawn: 5, dayStart: 6, dusk: 20, night: 21 }, summer: { dawn: 4, dayStart: 5, dusk: 22, night: 23 }, autumn: { dawn: 6, dayStart: 7, dusk: 19, night: 20 }, winter: { dawn: 7, dayStart: 8, dusk: 17, night: 18 } };
          const d = { ...defs[sid], ...ov };
          return `<div class="season-daylen" data-season="${sid}">
            <strong>${SEASON_LABELS[sid]}</strong>
            <div class="grid-4" style="margin-top:6px;">
              ${['dawn','dayStart','dusk','night'].map(k => `<label>${k}: <input type="number" min="0" max="23" value="${d[k]}"
                onchange="Editor.setSeasonDayLength('${sid}','${k}', parseInt(this.value,10))"></label>`).join('')}
            </div>
          </div>`;
        }).join('')}
      </div>

      <div class="climate-section project-info">
        <h4>🌦️ Погода по регионам</h4>
        ${regionIds.map(rid => this.renderRegionEditor(rid, regions[rid])).join('')}
        <button type="button" class="btn btn-secondary" onclick="Editor.addClimateRegion()">+ Добавить регион</button>
      </div>

      <div class="climate-section project-info">
        <h4>🗺️ Привязка регионов к сценам</h4>
        <table class="climate-map-table" style="width:100%;font-size:13px;">
          <tr><th>Сцена</th><th>Регион</th></tr>
          ${Object.keys(this.data.scenes || {}).map(sid => {
            const reg = this.data.scenes[sid]?.climate?.region || 'default';
            return `<tr><td>${this.escapeHtml(sid)}</td><td>
              <select onchange="Editor.setSceneClimateRegion('${this.escapeAttr(sid)}', this.value)">
                ${regionIds.map(r => `<option value="${this.escapeAttr(r)}" ${reg === r ? 'selected' : ''}>${this.escapeHtml(r)}</option>`).join('')}
              </select>
            </td></tr>`;
          }).join('')}
        </table>
      </div>
    </div>`;
  };

  Editor.renderRegionEditor = function (regionId, region) {
    const weights = region.weights || {};
    return `<div class="region-weather project-info" style="margin:10px 0;padding:10px;border:1px solid var(--border);">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <h5>Регион: ${this.escapeHtml(regionId)}</h5>
        ${regionId !== 'default' ? `<button type="button" class="btn btn-danger" style="font-size:11px;" onclick="Editor.removeClimateRegion('${this.escapeAttr(regionId)}')">×</button>` : ''}
      </div>
      <label>Базовая температура (°C): <input type="number" min="-30" max="40" value="${region.baseTemp ?? 0}"
        onchange="Editor.setRegionBaseTemp('${this.escapeAttr(regionId)}', parseInt(this.value,10)||0)"></label>
      ${SEASON_IDS.map(sid => {
        const sw = weights[sid] || {};
        return `<div class="season-weights" style="margin-top:8px;">
          <strong>${SEASON_LABELS[sid]}</strong>
          ${WEATHER_KEYS.map(wk => `<label style="display:inline-block;margin:2px 8px;">${wk}: <input type="number" class="w-${wk}" value="${sw[wk] ?? 0}" min="0" max="100" style="width:48px;"
            onchange="Editor.setRegionWeight('${this.escapeAttr(regionId)}','${sid}','${wk}', parseInt(this.value,10)||0)">%</label>`).join('')}
        </div>`;
      }).join('')}
    </div>`;
  };

  Editor.setClimateSetting = function (key, val) {
    const c = this.ensureClimateSettings();
    c[key] = val;
    this.updateJSONPreview();
  };

  Editor.setClimateStartDate = function (key, val) {
    const c = this.ensureClimateSettings();
    if (!c.startDate) c.startDate = {};
    c.startDate[key] = val;
    this.updateJSONPreview();
  };

  Editor.setSeasonDayLength = function (seasonId, field, val) {
    const c = this.ensureClimateSettings();
    if (!c.seasons) c.seasons = {};
    if (!c.seasons[seasonId]) c.seasons[seasonId] = {};
    if (!c.seasons[seasonId].dayLength) c.seasons[seasonId].dayLength = {};
    c.seasons[seasonId].dayLength[field] = val;
    this.updateJSONPreview();
  };

  Editor.setRegionBaseTemp = function (regionId, val) {
    const c = this.ensureClimateSettings();
    if (!c.regions[regionId]) c.regions[regionId] = { weights: {} };
    c.regions[regionId].baseTemp = val;
    this.updateJSONPreview();
  };

  Editor.setRegionWeight = function (regionId, seasonId, weatherKey, val) {
    const c = this.ensureClimateSettings();
    if (!c.regions[regionId]) c.regions[regionId] = { weights: {} };
    if (!c.regions[regionId].weights) c.regions[regionId].weights = {};
    if (!c.regions[regionId].weights[seasonId]) c.regions[regionId].weights[seasonId] = {};
    c.regions[regionId].weights[seasonId][weatherKey] = val;
    this.updateJSONPreview();
  };

  Editor.addClimateRegion = function () {
    const id = prompt('ID региона (латиница):', 'mountains');
    if (!id || !/^[a-z0-9_]+$/i.test(id)) return;
    const c = this.ensureClimateSettings();
    if (c.regions[id]) { alert('Регион уже существует'); return; }
    c.regions[id] = JSON.parse(JSON.stringify(c.regions.default || { baseTemp: -5, weights: {} }));
    this.renderClimateTab();
    this.updateJSONPreview();
  };

  Editor.removeClimateRegion = function (regionId) {
    if (!confirm(`Удалить регион ${regionId}?`)) return;
    const c = this.ensureClimateSettings();
    delete c.regions[regionId];
    Object.values(this.data.scenes || {}).forEach((sc) => {
      if (sc.climate?.region === regionId) sc.climate.region = 'default';
    });
    this.renderClimateTab();
    this.updateJSONPreview();
  };

  Editor.setSceneClimateRegion = function (sceneId, regionId) {
    const cl = this.ensureSceneClimate(sceneId);
    cl.region = regionId || 'default';
    this.updateJSONPreview();
  };

  Editor.renderSceneClimateSection = function (scene) {
    const cl = scene.climate || {};
    const hours = cl.operatingHours || {};
    const openH = String(hours.open ?? 8).padStart(2, '0') + ':00';
    const closeH = String(hours.close ?? 19).padStart(2, '0') + ':00';

    const timeBlock = PERIOD_IDS.map((pid) => {
      const tv = cl.timeVariants?.[pid] || scene.timeVariants?.[pid] || {};
      const enabled = !!(cl.timeVariants?.[pid] || scene.timeVariants?.[pid]);
      return `<div class="time-variant project-info" data-period="${pid}" style="margin:8px 0;">
        <label><input type="checkbox" ${enabled ? 'checked' : ''}
          onchange="Editor.toggleSceneTimeVariant('${pid}', this.checked)"> ${PERIOD_LABELS[pid]}</label>
        <textarea placeholder="Описание…" onchange="Editor.setSceneTimeVariantText('${pid}', this.value)">${this.escapeHtml(tv.text || '')}</textarea>
      </div>`;
    }).join('');

    const seasonBlock = SEASON_IDS.map((sid) => {
      const sv = cl.seasonVariants?.[sid] || {};
      const enabled = !!cl.seasonVariants?.[sid];
      return `<div class="season-variant project-info" style="margin:8px 0;">
        <label><input type="checkbox" ${enabled ? 'checked' : ''}
          onchange="Editor.toggleSceneSeasonVariant('${sid}', this.checked)"> ${SEASON_LABELS[sid]}</label>
        <textarea placeholder="Сезонное описание…" onchange="Editor.setSceneSeasonVariantText('${sid}', this.value)">${this.escapeHtml(sv.text || '')}</textarea>
        <label>Модиф. часов: <input type="number" value="${sv.hourMod ?? 0}" style="width:60px;"
          onchange="Editor.setSceneSeasonHourMod('${sid}', parseInt(this.value,10)||0)"></label>
      </div>`;
    }).join('');

    const weatherBlock = WEATHER_VARIANT_KEYS.map((wid) => {
      const wv = cl.weatherVariants?.[wid] || {};
      const enabled = !!cl.weatherVariants?.[wid];
      return `<div class="weather-variant project-info" style="margin:8px 0;">
        <label><input type="checkbox" ${enabled ? 'checked' : ''}
          onchange="Editor.toggleSceneWeatherVariant('${wid}', this.checked)"> ${wid}</label>
        <textarea placeholder="Описание при этой погоде…" onchange="Editor.setSceneWeatherVariantText('${wid}', this.value)">${this.escapeHtml(wv.text || '')}</textarea>
        <label>Закрыто: <input type="checkbox" ${wv.closed ? 'checked' : ''}
          onchange="Editor.setSceneWeatherClosed('${wid}', this.checked)"></label>
      </div>`;
    }).join('');

    const events = cl.weatherEvents || [];
    const eventsBlock = events.map((ev, i) => `<div class="weather-event project-info" style="margin:8px 0;">
      <label>Погода: <select onchange="Editor.setWeatherEventField(${i},'weather',this.value)">
        ${WEATHER_VARIANT_KEYS.map(w => `<option value="${w}" ${ev.weather === w ? 'selected' : ''}>${w}</option>`).join('')}
      </select></label>
      <label>Шанс %: <input type="number" min="0" max="100" value="${ev.chance ?? 20}" style="width:56px;"
        onchange="Editor.setWeatherEventField(${i},'chance', parseInt(this.value,10)||0)"></label>
      <label>Действие: <select onchange="Editor.setWeatherEventField(${i},'action',this.value)">
        <option value="show_text" ${ev.action === 'show_text' ? 'selected' : ''}>Текст</option>
        <option value="start_combat" ${ev.action === 'start_combat' ? 'selected' : ''}>Бой</option>
      </select></label>
      <textarea placeholder='{"text":"…"}' onchange="Editor.setWeatherEventParams(${i}, this.value)">${this.escapeHtml(JSON.stringify(ev.params || {}, null, 0))}</textarea>
      <button type="button" class="btn btn-danger" onclick="Editor.removeWeatherEvent(${i})">×</button>
    </div>`).join('');

    const regions = Object.keys(this.ensureClimateSettings().regions || { default: {} });

    return `<div class="scene-climate-section project-info" style="margin-top:16px;border-top:2px solid var(--border);padding-top:12px;">
      <h4>⏰ Время и погода сцены</h4>
      <div class="form-group">
        <label>Климатический регион</label>
        <select onchange="Editor.setSceneClimateField('region', this.value)">
          ${regions.map(r => `<option value="${this.escapeAttr(r)}" ${(cl.region || 'default') === r ? 'selected' : ''}>${this.escapeHtml(r)}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label><input type="checkbox" ${cl.indoor ? 'checked' : ''} onchange="Editor.setSceneClimateField('indoor', this.checked)"> Помещение (нет ударов молнии с неба)</label>
      </div>
      <div class="scene-hours">
        <h5>Часы работы</h5>
        <label>Открытие: <input type="time" value="${openH}" onchange="Editor.setSceneHours('open', this.value)"></label>
        <label>Закрытие: <input type="time" value="${closeH}" onchange="Editor.setSceneHours('close', this.value)"></label>
        <label><input type="checkbox" ${hours.seasonal !== false ? 'checked' : ''} onchange="Editor.setSceneHoursFlag('seasonal', this.checked)"> Учитывать сезон</label>
        <label><input type="checkbox" ${hours.weatherDependent ? 'checked' : ''} onchange="Editor.setSceneHoursFlag('weatherDependent', this.checked)"> Закрыто в пургу/урагане</label>
      </div>
      <details open><summary><strong>Варианты по времени суток</strong></summary>${timeBlock}</details>
      <details><summary><strong>Варианты по сезону</strong></summary>${seasonBlock}</details>
      <details><summary><strong>Варианты по погоде</strong></summary>${weatherBlock}</details>
      <details><summary><strong>События погоды</strong></summary>
        ${eventsBlock}
        <button type="button" class="btn btn-secondary" onclick="Editor.addWeatherEvent()">+ Событие</button>
      </details>
    </div>`;
  };

  Editor.setSceneClimateField = function (key, val) {
    const cl = this.ensureSceneClimate(this.currentScene);
    cl[key] = val;
    this.updateJSONPreview();
  };

  Editor.setSceneHours = function (key, timeVal) {
    const cl = this.ensureSceneClimate(this.currentScene);
    if (!cl.operatingHours) cl.operatingHours = {};
    const parts = (timeVal || '08:00').split(':');
    cl.operatingHours[key] = parseInt(parts[0], 10) || 0;
    this.updateJSONPreview();
  };

  Editor.setSceneHoursFlag = function (key, val) {
    const cl = this.ensureSceneClimate(this.currentScene);
    if (!cl.operatingHours) cl.operatingHours = {};
    cl.operatingHours[key] = val;
    this.updateJSONPreview();
  };

  Editor._ensureVariantBucket = function (bucket) {
    const cl = this.ensureSceneClimate(this.currentScene);
    if (!cl[bucket]) cl[bucket] = {};
    return cl[bucket];
  };

  Editor.toggleSceneTimeVariant = function (period, on) {
    const bucket = this._ensureVariantBucket('timeVariants');
    if (on && !bucket[period]) bucket[period] = { text: '' };
    else if (!on) delete bucket[period];
    this.renderSceneEditor();
    this.updateJSONPreview();
  };

  Editor.setSceneTimeVariantText = function (period, text) {
    const bucket = this._ensureVariantBucket('timeVariants');
    if (!bucket[period]) bucket[period] = {};
    bucket[period].text = text;
    this.updateJSONPreview();
  };

  Editor.toggleSceneSeasonVariant = function (season, on) {
    const bucket = this._ensureVariantBucket('seasonVariants');
    if (on && !bucket[season]) bucket[season] = { text: '' };
    else if (!on) delete bucket[season];
    this.renderSceneEditor();
    this.updateJSONPreview();
  };

  Editor.setSceneSeasonVariantText = function (season, text) {
    const bucket = this._ensureVariantBucket('seasonVariants');
    if (!bucket[season]) bucket[season] = {};
    bucket[season].text = text;
    this.updateJSONPreview();
  };

  Editor.setSceneSeasonHourMod = function (season, val) {
    const bucket = this._ensureVariantBucket('seasonVariants');
    if (!bucket[season]) bucket[season] = {};
    bucket[season].hourMod = val;
    this.updateJSONPreview();
  };

  Editor.toggleSceneWeatherVariant = function (weather, on) {
    const bucket = this._ensureVariantBucket('weatherVariants');
    if (on && !bucket[weather]) bucket[weather] = { text: '' };
    else if (!on) delete bucket[weather];
    this.renderSceneEditor();
    this.updateJSONPreview();
  };

  Editor.setSceneWeatherVariantText = function (weather, text) {
    const bucket = this._ensureVariantBucket('weatherVariants');
    if (!bucket[weather]) bucket[weather] = {};
    bucket[weather].text = text;
    this.updateJSONPreview();
  };

  Editor.setSceneWeatherClosed = function (weather, closed) {
    const bucket = this._ensureVariantBucket('weatherVariants');
    if (!bucket[weather]) bucket[weather] = {};
    bucket[weather].closed = closed;
    this.updateJSONPreview();
  };

  Editor.addWeatherEvent = function () {
    const cl = this.ensureSceneClimate(this.currentScene);
    if (!cl.weatherEvents) cl.weatherEvents = [];
    cl.weatherEvents.push({ weather: 'thunderstorm', chance: 20, action: 'show_text', params: { text: '' } });
    this.renderSceneEditor();
    this.updateJSONPreview();
  };

  Editor.setWeatherEventField = function (idx, key, val) {
    const cl = this.ensureSceneClimate(this.currentScene);
    if (!cl.weatherEvents?.[idx]) return;
    cl.weatherEvents[idx][key] = val;
    this.updateJSONPreview();
  };

  Editor.setWeatherEventParams = function (idx, raw) {
    const cl = this.ensureSceneClimate(this.currentScene);
    if (!cl.weatherEvents?.[idx]) return;
    try {
      cl.weatherEvents[idx].params = JSON.parse(raw || '{}');
    } catch (e) {
      alert('Неверный JSON');
    }
    this.updateJSONPreview();
  };

  Editor.removeWeatherEvent = function (idx) {
    const cl = this.ensureSceneClimate(this.currentScene);
    cl.weatherEvents?.splice(idx, 1);
    this.renderSceneEditor();
    this.updateJSONPreview();
  };

  const origRender = Editor.renderSceneEditor.bind(Editor);
  Editor.renderSceneEditor = function () {
    origRender();
    const container = document.getElementById('scene-editor');
    const scene = this.currentScene && this.data?.scenes?.[this.currentScene];
    if (!container || !scene) return;
    const section = this.renderSceneClimateSection(scene);
    const div = document.createElement('div');
    div.innerHTML = section;
    container.appendChild(div.firstElementChild);
  };
})();
