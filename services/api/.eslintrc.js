const base = require('../../.eslintrc.base.js');
// Deployed migrations are immutable (see CLAUDE.md §Database Migrations), so they are not linted.
module.exports = { ...base, root: true, ignorePatterns: ['src/migrations/**'] };
