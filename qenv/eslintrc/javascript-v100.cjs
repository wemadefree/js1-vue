module.exports = {
    rules: {
        'brace-style': ['error', 'stroustrup'],
        'comma-dangle': ['error', 'always-multiline'],
        'no-multiple-empty-lines': 'off',
        'no-return-assign': 'off',
        'no-unreachable': 'warn',
        'no-unused-vars': 'warn',
        'operator-linebreak': 'off',
        'padded-blocks': 'off',
        'prefer-const': 'off',
        'promise/param-names': 'off',
        'quote-props': 'off',
        'semi': 'off',
        'vue/no-unused-components': 'warn',
        'space-before-function-paren': ['error', {
            anonymous: 'always',
            named: 'never',
            asyncArrow: 'always',
        }],
    }
};
