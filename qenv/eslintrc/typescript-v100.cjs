const { resolve } = require('path');

module.exports = {
    extends: [
        resolve(__dirname, 'javascript-v100.cjs'),
    ],
    rules: {
        '@typescript-eslint/no-unsafe-member-access': 'off',
        '@typescript-eslint/no-unsafe-return': 'off',
        '@typescript-eslint/no-unsafe-call': 'off',
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-unsafe-assignment': 'off',
        '@typescript-eslint/restrict-template-expressions': 'off',
        '@typescript-eslint/no-floating-promises': 'off',
        '@typescript-eslint/no-empty-function': 'off',
        '@typescript-eslint/restrict-plus-operands': 'off',
        '@typescript-eslint/require-await': 'off',
        '@typescript-eslint/prefer-regexp-exec': 'warn',
        '@typescript-eslint/unbound-method': 'warn',
    }
};
