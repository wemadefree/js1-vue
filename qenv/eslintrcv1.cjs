const { resolve } = require('path');

// Extend eslintrc with common defaults
module.exports = function (cfg) {
    console.warn(`eslintrcv1.cjs is deprecated. Add a direct reference  to './node_modules/@we-made/js1-vue/qenv/eslintrc/javascript-v100.cjs' in cfg.extends instead.`);
    cfg.extends.push(resolve(__dirname, './eslintrc/javascript-v100.cjs'));
    return cfg;
};
