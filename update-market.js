'use strict';
// Compatibility entry point. Keep a single publication-validation implementation.
const updater = require('./scripts/update-market.js');
if (require.main === module) updater.generate().catch(() => { console.error('Unable to persist safe briefing state'); process.exitCode = 1; });
module.exports = updater;
