node --check blockit-ui.js && echo OK
wc -l blockit-ui.js
grep -c "function \|spelKanaal.on(" blockit-ui.js
grep -c "bi-aanval\|BOM_STRAAL" blockit-ui.js
tail -2 blockit-ui.js
