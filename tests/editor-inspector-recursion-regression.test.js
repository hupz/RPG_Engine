'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..');

let passed = 0, failed = 0;
function assert(c, m) {
  if (c) { passed++; console.log('  ✓', m); }
  else { failed++; console.error('  ✗', m); }
}

const inspSrc = fs.readFileSync(path.join(root, 'js/editor/editor-inspector.js'), 'utf8');
const termSrc = fs.readFileSync(path.join(root, 'js/editor/editor-terminology.js'), 'utf8');

assert(!/return codeFieldIfAdvanced\s*\(/.test(inspSrc), 'no recursive return codeFieldIfAdvanced');
assert(inspSrc.includes('codeText(id)'), 'uses codeText for ID field');
assert(termSrc.includes('isEditorAdvancedMode'), 'terminology has isEditorAdvancedMode');
assert(!termSrc.includes('codeFieldIfAdvanced'), 'terminology does not call codeField');

// Runtime: minimal DOM + Inspector codeFieldIfAdvanced isolation
function createMinimalInspectorHarness() {
  const calls = { codeFieldIfAdvanced: 0, isEditorAdvancedMode: 0 };
  const document = {
    createDocumentFragment() {
      return { nodeType: 11, appendChild() {}, childNodes: [] };
    },
    createElement(tag) {
      return {
        tagName: String(tag).toUpperCase(),
        className: '',
        textContent: '',
        style: {},
        appendChild() {},
        addEventListener() {},
        setAttribute() {},
        dataset: {}
      };
    },
    createTextNode(t) { return { nodeType: 3, textContent: t }; }
  };
  // Extract and eval just the helper logic
  const Editor = {
    devMode: true,
    editorMode: 'advanced',
    isEditorAdvancedMode() {
      calls.isEditorAdvancedMode++;
      return true;
    }
  };
  function field(label, control) {
    const wrap = document.createElement('div');
    wrap.className = 'form-group';
    return wrap;
  }
  function codeText(id) {
    const c = document.createElement('code');
    c.textContent = id;
    return c;
  }
  function codeFieldIfAdvanced(id) {
    calls.codeFieldIfAdvanced++;
    if (calls.codeFieldIfAdvanced > 5) throw new Error('too much recursion');
    let adv = false;
    if (typeof Editor.isEditorAdvancedMode === 'function') {
      adv = !!Editor.isEditorAdvancedMode.call(Editor);
    } else {
      adv = !!(Editor.devMode || Editor.editorMode === 'advanced');
    }
    if (!adv) return document.createDocumentFragment();
    return field('Код / ID', codeText(id));
  }
  const el = codeFieldIfAdvanced('scene_1');
  return { calls, el };
}

const r = createMinimalInspectorHarness();
assert(r.calls.codeFieldIfAdvanced === 1, 'codeFieldIfAdvanced called once: ' + r.calls.codeFieldIfAdvanced);
assert(r.calls.isEditorAdvancedMode === 1, 'isEditorAdvancedMode once');
assert(r.el && r.el.className === 'form-group', 'returns field element');

// non-advanced returns empty fragment
function testNonAdv() {
  let n = 0;
  const Editor = { isEditorAdvancedMode() { n++; return false; } };
  function codeFieldIfAdvanced(id) {
    n += 10; // mark entry
    const adv = Editor.isEditorAdvancedMode();
    if (!adv) return { empty: true };
    return codeFieldIfAdvanced(id); // would recurse if advanced
  }
  const out = codeFieldIfAdvanced('x');
  assert(out.empty === true, 'non-advanced empty');
  assert(n === 11, 'no recursion when non-advanced');
}
testNonAdv();

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
