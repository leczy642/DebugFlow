module.exports = {
  root: true,
  env: { node: true, es2022: true },
  parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
  extends: ['eslint:recommended', 'plugin:node/recommended', 'prettier'],
  plugins: [],
  rules: {
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'node/no-unsupported-features/es-syntax': 'off'
  }
};
