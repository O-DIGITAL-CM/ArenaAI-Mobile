process.env.NODE_ENV = 'production';
const webpack = require('@nativescript/webpack');
const wp = require('webpack');
webpack.init({ ios: true, production: true, buildPath: 'platforms' });
const config = webpack.resolveConfig();
wp(config, (err, stats) => {
  if (err) { console.error('FATAL', err); process.exit(1); }
  const info = stats.toJson({ all: false, errors: true, warnings: true });
  (info.errors || []).slice(0, 6).forEach(e => console.log('ERR - ' + (e.message || e).slice(0, 900)));
  console.log('BUILD IOS', stats.hasErrors() ? 'FAILED' : 'OK');
  process.exit(stats.hasErrors() ? 1 : 0);
});
