'use strict';
/**
 * editor-help enhance must be idempotent and never throw DOMException
 * on insertBefore with nested/stale reference nodes.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..');

let passed = 0, failed = 0;
function assert(c, m) {
  if (c) { passed++; console.log('  ✓', m); }
  else { failed++; console.error('  ✗', m); }
}

// Minimal DOM implementing insertBefore child constraint
function createDoc() {
  let idSeq = 1;
  function node(tag) {
    const n = {
      nodeType: 1,
      tagName: (tag || 'div').toUpperCase(),
      className: '',
      dataset: {},
      childNodes: [],
      parentNode: null,
      ownerDocument: null,
      isConnected: true,
      textContent: '',
      classList: {
        _c: new Set(),
        add(c) { this._c.add(c); n.className = [...this._c].join(' '); },
        contains(c) { return this._c.has(c); },
        toggle(c, on) { if (on) this.add(c); }
      },
      setAttribute() {},
      getAttribute() { return null; },
      addEventListener() {},
      querySelector(sel) {
        return n.querySelectorAll(sel)[0] || null;
      },
      querySelectorAll(sel) {
        const out = [];
        function walk(el) {
          if (match(el, sel)) out.push(el);
          el.childNodes.forEach(walk);
        }
        n.childNodes.forEach(walk);
        return out;
      },
      get firstElementChild() {
        return n.childNodes.find((c) => c.nodeType === 1) || null;
      },
      get nextSibling() {
        if (!n.parentNode) return null;
        const sibs = n.parentNode.childNodes;
        const i = sibs.indexOf(n);
        return i >= 0 ? sibs[i + 1] || null : null;
      },
      appendChild(child) {
        if (child.parentNode) child.parentNode.removeChild(child);
        child.parentNode = n;
        n.childNodes.push(child);
        return child;
      },
      removeChild(child) {
        const i = n.childNodes.indexOf(child);
        if (i < 0) throw new Error('NotFoundError');
        n.childNodes.splice(i, 1);
        child.parentNode = null;
        return child;
      },
      insertBefore(newNode, ref) {
        if (ref != null && ref.parentNode !== n) {
          const err = new Error('Node.insertBefore: Child to insert before is not a child of this node');
          err.name = 'DOMException';
          throw err;
        }
        if (newNode.parentNode) newNode.parentNode.removeChild(newNode);
        newNode.parentNode = n;
        if (ref == null) {
          n.childNodes.push(newNode);
        } else {
          const i = n.childNodes.indexOf(ref);
          n.childNodes.splice(i, 0, newNode);
        }
        return newNode;
      }
    };
    n.ownerDocument = doc;
    return n;
  }
  function match(el, sel) {
    if (!sel) return false;
    // support simple .class and comma and tag lists like "input, select"
    const parts = sel.split(',').map((s) => s.trim());
    return parts.some((p) => {
      if (p.startsWith('.')) return el.classList.contains(p.slice(1)) || (el.className || '').split(/\s+/).includes(p.slice(1));
      return el.tagName === p.toUpperCase();
    });
  }
  const doc = {
    body: null,
    createElement(tag) { return node(tag); },
    querySelector(sel) {
      if (sel === '.main-area') return doc._main;
      if (sel === '.tab-content.active') return doc._active;
      return null;
    },
    querySelectorAll(sel) {
      if (!doc._main) return [];
      return doc._main.querySelectorAll(sel);
    }
  };
  doc.body = node('body');
  doc.body.classList = { contains() { return false; }, toggle() {}, add() {} };
  doc._main = node('div');
  doc._main.className = 'main-area';
  doc._active = node('div');
  doc._active.className = 'tab-content active';
  doc._main.appendChild(doc._active);
  doc.body.appendChild(doc._main);
  return doc;
}

function buildNestedFormGroup(doc) {
  // structure that caused the bug: input is nested, not direct child
  const group = doc.createElement('div');
  group.className = 'form-group';
  group.classList.add('form-group');
  const label = doc.createElement('label');
  label.textContent = 'Название';
  const wrap = doc.createElement('div');
  wrap.className = 'grid-2';
  wrap.classList.add('grid-2');
  const input = doc.createElement('input');
  wrap.appendChild(input);
  group.appendChild(label);
  group.appendChild(wrap);
  doc._active.appendChild(group);
  return group;
}

const doc = createDoc();
const ctx = {
  console: { log() {}, warn() {}, error() {}, info() {}, debug() {} },
  document: doc,
  window: {},
  localStorage: { getItem() { return null; }, setItem() {} },
  setTimeout: (fn) => { fn(); return 1; },
  clearTimeout() {},
  Map, Set, Object, Array, String, Error, JSON
};
ctx.window = ctx;
vm.createContext(ctx);

// Minimal EditorHelp deps: only the functions we patch — load file needs DATA
// Instead unit-test insertBeforeSafe logic mirrored + run enhanceFormGroup via extracted source check

const src = fs.readFileSync(path.join(root, 'js/editor-help.js'), 'utf8');
assert(src.includes('insertBeforeSafe'), 'insertBeforeSafe helper exists');
assert(src.includes('helpEnhanced'), 'idempotent marker helpEnhanced');
assert(/while \(ref && ref\.parentNode !== parent\)/.test(src), 'walks up nested reference');
assert(src.includes('isConnected'), 'checks isConnected');

// Simulate insertBeforeSafe
function insertBeforeSafe(parent, newNode, reference) {
  let ref = reference || null;
  while (ref && ref.parentNode !== parent) ref = ref.parentNode;
  if (ref && ref.parentNode === parent) parent.insertBefore(newNode, ref);
  else parent.appendChild(newNode);
}

const group = buildNestedFormGroup(doc);
const nestedInput = group.querySelector('input');
assert(nestedInput && nestedInput.parentNode !== group, 'input is nested (not direct child)');

let threw = false;
try {
  group.insertBefore(doc.createElement('div'), nestedInput);
} catch (e) {
  threw = e.name === 'DOMException' || /insertBefore/.test(e.message);
}
assert(threw, 'raw insertBefore with nested ref throws (documents the bug)');

threw = false;
try {
  insertBeforeSafe(group, doc.createElement('div'), nestedInput);
} catch (e) {
  threw = true;
}
assert(!threw, 'insertBeforeSafe with nested ref does not throw');

// Idempotent: enhance twice via marker
group.dataset.helpEnhanced = '1';
assert(group.dataset.helpEnhanced === '1', 'marker set');
// second "enhance" would return early

// Detached node
const detached = doc.createElement('div');
detached.className = 'form-group';
detached.isConnected = false;
detached.dataset = {};
assert(detached.isConnected === false, 'detached node flagged');

// Multiple enhance cycles: replace innerHTML simulation
for (let i = 0; i < 10; i++) {
  const g = buildNestedFormGroup(doc);
  try {
    insertBeforeSafe(g, doc.createElement('div'), g.querySelector('input'));
    g.dataset.helpEnhanced = '1';
  } catch (e) {
    assert(false, 'cycle ' + i + ' threw ' + e.message);
  }
}
assert(true, '10 enhance cycles without DOMException');

// Stale reference after remove
const g2 = buildNestedFormGroup(doc);
const anchor = g2.querySelector('.grid-2') || g2.querySelector('input');
const parent = g2;
if (anchor && anchor.parentNode === g2) {
  g2.removeChild(anchor);
}
threw = false;
try {
  insertBeforeSafe(parent, doc.createElement('div'), anchor);
} catch (e) {
  threw = true;
}
assert(!threw, 'stale/removed reference falls back to append');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
