Package.describe({
  name: 'zodern:aurorae-compiler',
  description: 'Aurorae compiler for story files',
  git: 'https://github.com/zodern/aurorae-compiler.git',
  documentation: './readme.md'
});

Package.onUse(api => {
  api.versionsFrom('2.0')
  api.use('isobuild:compiler-plugin@1.0.0');
});

Package.registerBuildPlugin({
  name: 'compile-stories',
  use: ['babel-compiler', 'react-fast-refresh'],
  sources: ['build-plugin.js']
});
