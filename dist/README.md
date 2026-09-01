# Bundles

`node scripts/build.mjs [engine|editor|editor-full|index-prod|all]`

- `engine.bundle.js` — runtime + data-schema
- `editor-core.bundle.js` — hooks/utils/data-load (after const Editor)
- `editor-full.bundle.js` — все внешние скрипты editor.html (concat, порядок из HTML)
- `editor-bundle.html` — editor.html с одним тегом `dist/editor-full.bundle.js`
- `index-prod.bundle.js` — модули тела index.html (prod-порядок, engine → engine.bundle)
- `index.prod.html` — index.html с одним тегом `dist/index-prod.bundle.js` в теле
