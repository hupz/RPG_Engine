# Bundles

`node scripts/build.mjs [engine|editor|editor-full|all]`

- `engine.bundle.js` — runtime + data-schema
- `editor-core.bundle.js` — hooks/utils/data-load (after const Editor)
- `editor-full.bundle.js` — все внешние скрипты editor.html (concat, порядок из HTML)
- `editor-bundle.html` — editor.html с одним тегом `dist/editor-full.bundle.js`
