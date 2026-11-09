process.env.NODE_ENV = 'production';
const path = require('path');
const webpack = require('@nativescript/webpack');
const wp = require('webpack');

webpack.init({ android: true, production: true, buildPath: 'platforms' });
const config = webpack.resolveConfig();
config.stats = 'errors-warnings';

wp(config, (err, stats) => {
  if (err) { console.error('FATAL', err); process.exit(1); }
  const info = stats.toJson({ all: false, errors: true, warnings: true });
  if (info.errors?.length) {
    console.log('=== ERRORS ===');
    info.errors.slice(0, 8).forEach(e => console.log('- ' + (e.message || e).slice(0, 1200)));
  }
  if (info.warnings?.length) {
    console.log('=== WARNINGS (' + info.warnings.length + ') ===');
    info.warnings.slice(0, 6).forEach(w => console.log('- ' + (w.message || w).slice(0, 400)));
  }
  console.log('BUILD', stats.hasErrors() ? 'FAILED' : 'OK');
  process.exit(stats.hasErrors() ? 1 : 0);
});
