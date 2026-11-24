import firebaseRulesPlugin from '@firebase/eslint-plugin-security-rules';

export default [
  {
    ignores: ['dist/**/*', 'node_modules/**/*', 'private_uploads/**/*', 'data/**/*'],
  },
  firebaseRulesPlugin.configs['flat/recommended'],
];
