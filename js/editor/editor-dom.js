// ============================================================
// Editor DOM helpers — правило для НОВОГО UI-кода
//
// ПРАВИЛО: «Новый Editor UI не использует inline onclick.»
//
// Использовать:
//   - document.createElement / EditorDOM.el
//   - textContent / EditorDOM.text
//   - addEventListener / делегирование data-action
//   - data-* attributes
//   - component render functions, возвращающие Element или DocumentFragment
//
// Не использовать в новом коде:
//   - inline onclick / onchange / oninput в HTML-строках
//   - небезопасную склейку HTML с пользовательскими данными без escape
//
// Legacy-модули не переписывать массово — только при активной доработке.
// ============================================================
(function attachEditorDOM() {
  'use strict';
  if (typeof Editor === 'undefined') return;

  function el(tag, props, children) {
    const node = document.createElement(tag);
    if (props) {
      Object.keys(props).forEach((key) => {
        const val = props[key];
        if (val == null || val === false) return;
        if (key === 'className' || key === 'class') {
          node.className = String(val);
        } else if (key === 'text') {
          node.textContent = String(val);
        } else if (key === 'html') {
          // только для доверенного статического markup
          node.innerHTML = String(val);
        } else if (key === 'style' && val && typeof val === 'object') {
          Object.assign(node.style, val);
        } else if (key === 'dataset' && val && typeof val === 'object') {
          Object.keys(val).forEach((dk) => {
            if (val[dk] != null) node.dataset[dk] = String(val[dk]);
          });
        } else if (key.startsWith('on') && typeof val === 'function') {
          const evt = key.slice(2).toLowerCase();
          node.addEventListener(evt, val);
        } else if (key === 'attrs' && val && typeof val === 'object') {
          Object.keys(val).forEach((ak) => {
            if (val[ak] != null) node.setAttribute(ak, String(val[ak]));
          });
        } else if (key === 'disabled') {
          node.disabled = !!val;
        } else if (key === 'value') {
          node.value = val;
        } else {
          node.setAttribute(key, val === true ? '' : String(val));
        }
      });
    }
    const list = children == null ? [] : Array.isArray(children) ? children : [children];
    list.forEach((child) => {
      if (child == null || child === false) return;
      if (typeof child === 'string' || typeof child === 'number') {
        node.appendChild(document.createTextNode(String(child)));
      } else {
        node.appendChild(child);
      }
    });
    return node;
  }

  function clear(node) {
    if (!node) return;
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function text(node, value) {
    if (node) node.textContent = value == null ? '' : String(value);
  }

  /**
   * Делегирование кликов по [data-action] внутри root.
   * handlers: { actionName: (ev, el) => void }
   */
  function delegate(root, handlers, eventName) {
    if (!root || !handlers) return () => {};
    const type = eventName || 'click';
    const fn = (ev) => {
      const target = ev.target && ev.target.closest ? ev.target.closest('[data-action]') : null;
      if (!target || !root.contains(target)) return;
      const action = target.getAttribute('data-action');
      if (!action || typeof handlers[action] !== 'function') return;
      handlers[action](ev, target);
    };
    root.addEventListener(type, fn);
    return () => root.removeEventListener(type, fn);
  }

  /**
   * Поля формы без inline onchange.
   * onChange(value, inputEl)
   */
  function input(opts) {
    opts = opts || {};
    const node = el(opts.multiline ? 'textarea' : 'input', {
      className: opts.className || '',
      type: opts.multiline ? undefined : (opts.type || 'text'),
      value: opts.value != null ? opts.value : '',
      placeholder: opts.placeholder || undefined,
      min: opts.min != null ? String(opts.min) : undefined,
      rows: opts.rows != null ? String(opts.rows) : undefined,
      dataset: opts.dataset,
      disabled: opts.disabled
    });
    if (opts.multiline && opts.value != null) node.value = String(opts.value);
    if (typeof opts.onChange === 'function') {
      const fire = () => opts.onChange(node.value, node);
      node.addEventListener('change', fire);
      if (opts.live) node.addEventListener('input', fire);
    }
    return node;
  }

  function button(label, opts) {
    opts = opts || {};
    return el('button', {
      type: 'button',
      className: opts.className || 'btn btn-secondary btn-sm',
      text: label,
      dataset: opts.dataset,
      disabled: opts.disabled,
      onClick: opts.onClick
    });
  }

  function formGroup(label, control) {
    return el('div', { className: 'form-group' }, [
      el('label', { text: label }),
      control
    ]);
  }

  const EditorDOM = {
    el,
    clear,
    text,
    delegate,
    input,
    button,
    formGroup,
    /** Правило для комментариев / lint-подсказок */
    RULE: 'Новый Editor UI не использует inline onclick.'
  };

  Editor.DOM = EditorDOM;
  if (typeof window !== 'undefined') window.EditorDOM = EditorDOM;

  if (Editor.hooks?.register) {
    Editor.hooks.register('editor-dom', { DOM: EditorDOM }, { force: true });
  }
})();
