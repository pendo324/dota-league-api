// http://eslint.org/docs/user-guide/configuring

module.exports = {
  root: true,
  env: {
    node: true,
  },
  extends: 'airbnb-base',
  // add your custom rules here
  'rules': {
    // allow debugger during development
    'no-debugger': process.env.NODE_ENV === 'production' ? 2 : 0,
    'comma-dangle': ['error', 'never'],
    'no-param-reassign': [2, { 'props': false }],
    'new-cap': ['error', { 'newIsCapExceptions': ['pgSession'], 'capIsNewExceptions': ['Router'] }],
    'no-underscore-dangle': [0, 'always']
  }
}