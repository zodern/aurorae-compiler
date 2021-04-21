Package.describe({
  name: 'zodern:aurorae-compiler',
  summary: 'Aurorae compiler for story files',
  git: 'https://github.com/zodern/aurorae-compiler.git',
  documentation: './readme.md',
  version: '0.1.2'
});

Package.onUse(api => {
  api.versionsFrom('2.0')
  api.use('isobuild:compiler-plugin@1.0.0');
});

Package.registerBuildPlugin({
  name: 'compile-stories',
  use: [
    'ecmascript@0.15.0',

    // For .stories.js files
    'babel-compiler@7.6.1', 'react-fast-refresh@0.1.0',

      // For .stories.html files
      'caching-html-compiler@1.2.0', 'templating-tools@1.2.0',

      // For .stories.svelte files
      'zodern:melte-compiler@1.0.2'
    ],
    sources: ['build-plugin.js']
  });
