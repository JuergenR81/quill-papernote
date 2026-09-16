/*eslint-env node*/

const { BannerPlugin, DefinePlugin } = require('webpack');
const common = require('./webpack.common.cjs');
const { merge } = require('webpack-merge');
require('webpack-dev-server');
const { readFileSync } = require('fs');
const { join, resolve } = require('path');

const pkg = JSON.parse(readFileSync(join(__dirname, 'package.json'), 'utf8'));

const bannerPack = new BannerPlugin({
  banner: [
    `Quill Editor v${pkg.version}`,
    pkg.homepage,
    `Copyright (c) ${new Date().getFullYear()}, Vincent Chan`,
    `Copyright (c) 2017-2025, Slab`,
    'Copyright (c) 2014, Jason Chen',
    'Copyright (c) 2013, salesforce.com',
  ].join('\n'),
  entryOnly: true,
});
const constantPack = new DefinePlugin({
  QUILL_VERSION: JSON.stringify(pkg.version),
});

module.exports = (env) =>
  merge(common, {
    mode: env.production ? 'production' : 'development',
    devtool: 'source-map',
    plugins: [bannerPack, constantPack],
    devServer: {
      // 'auto' picks a free port instead of failing when another instance already
      // holds the default one. The root dev script pins an explicit port so the
      // website knows where to load Quill from.
      port: process.env.QUILL_DEV_PORT
        ? Number(process.env.QUILL_DEV_PORT)
        : 'auto',
      static: [
        // demo/ first so its index.html is served at '/', next to the built quill.js
        // that it loads with a relative path.
        { directory: resolve(__dirname, './demo') },
        { directory: resolve(__dirname, './dist') },
      ],
      hot: false,
      allowedHosts: 'all',
      devMiddleware: {
        stats: 'minimal',
      },
    },
    stats: 'minimal',
  });
