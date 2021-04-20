// Overrides processFilesForTarget to ensure:
// 1. files outside of node_modules are eagerly loaded in development
// 2. files outside of node_modules are lazy in production builds
// 3. files in the server are always lazy
function createProcessFilesForTarget(CompilerClass, prepareContent) {
  prepareContent = prepareContent || ((data) => data);
  return function processFilesForTarget(files) {
    let toCompile = [];
    var isProd = process.env.NODE_ENV === 'production';

    files.forEach(file => {
      var path = file.getPathInPackage();
      var inNodeModules = path.startsWith('node_modules/') || path.includes('/node_modules/');
      var inServer = file.getArch().startsWith('os.');

      let oldAdd = file.constructor.prototype.addJavaScript;
      file.addJavaScript = function (options, lazyFinalizer) {
        if (typeof options.lazy !== 'boolean') {
          options.lazy = isProd || inServer || inNodeModules;
        };
        if (options.data !== undefined) {
          options.data = prepareContent(options.data)
        } else if (typeof lazyFinalizer === 'function') {
          var oldFinalizer = lazyFinalizer;
          lazyFinalizer = function () {
            let result = oldFinalizer.apply(this, arguments)
            result.data = prepareContent(result.data);
            return result;
          }
        }

        return oldAdd.call(this, options, lazyFinalizer);
      }
      toCompile.push(file);
    });

    return CompilerClass.prototype.processFilesForTarget.call(this, files);
  }
}

class Compiler extends BabelCompiler {

}
Compiler.prototype.processFilesForTarget = createProcessFilesForTarget(BabelCompiler);

class BlazeCompiler extends CachingHtmlCompiler { }
// BlazeCompiler.prototype.processFilesForTarget = createProcessFilesForTarget('.stories.html');
BlazeCompiler.prototype.processFilesForTarget = createProcessFilesForTarget(CachingHtmlCompiler, (data) => {
  var isProd = process.env.NODE_ENV === 'production';
  if (isProd) {
    return data;
  }

  return `
    var _autoAddStories = require('meteor/zodern:aurorae/blaze')._autoAddStories;
    _autoAddStories();
    ${data}
  `
});

import MelteCompiler from 'meteor/zodern:melte-compiler/MelteCompiler.js';
import svelteOptions from 'meteor/zodern:melte-compiler/options.js';

class SvelteCompiler extends MelteCompiler { };
SvelteCompiler.prototype.processFilesForTarget = createProcessFilesForTarget(MelteCompiler);

function getAttrValue(name, node) {
  const attribute = node.attributes.find(
    attr => attr.type === 'Attribute' && attr.name === name
  );

  if (!attribute) {
    return null;
  }

  const value = attribute.value;
  if (value && value.length === 1 && value[0].type === 'Text') {
    return value[0].data;
  }

  throw new Error(`Attribute ${name} is not static`);
}

let svelte;
async function preprocessSvelte(code, file) {
  if (svelte === undefined) {
    svelte = require('svelte/compiler');
  }

  const ast = svelte.parse(code);
 
  let storyName;
  svelte.walk(ast.instance, {
    enter(node) {
      if (
        node.type === 'ImportDeclaration' &&
        node.source.value === 'meteor/zodern:aurorae/svelte'
      ) {
        let storyImport = node.specifiers
          .find(s => s.type === 'ImportSpecifier' && s.imported.name === 'Story');
        storyName = storyImport.local.name;
      }
    }
  });

  if (!storyName) {
    return code;
  }

  let stories = [];
  svelte.walk(ast.html, {
    enter(node) {
      if (
        node.type === 'InlineComponent' &&
        (node.name === storyName)
      ) {
        this.skip();
        let name = getAttrValue('name', node);
        if (!name) {
          // TODO: handle this better
          throw new Error('Story is missing a name');
        }
        stories.push(name);
      }
    }
  });

  if (stories.length === 0) {
    return code;
  }

  const addStoryName = `___auroraeAddStory`;
  // TODO: update this to work for svelte files in packages
  // The component is imported within a timeout to avoid any issues with
  // importing itself.
  let codeToAdd = `
    const { addStory: ${addStoryName} } = require('meteor/zodern:aurorae/svelte');
    setTimeout(() => {
      const component = require('/${file.getPathInPackage()}').default;
  `

  stories.forEach(storyName => {
    codeToAdd += `
    ${addStoryName}("${storyName}", component);
    `
  });

  codeToAdd += `
});
`;

  let added = false;

  ({
    code,
  } = await svelte.preprocess(
    code,
    {
      script({ content, attributes, filename }) {
        // TODO: make sure the added imports and variable names are unique
        if (attributes.context === 'module') {
          content = codeToAdd + content;
          added = true;
        }

        return { code: content };
      }
    }));

  if (!added) {
    code = `
      <script context="module">
        ${codeToAdd}
      </script>
      ` + code;
  }

  return code;
}

Plugin.registerCompiler({
  extensions: ['stories.js'],
}, function () {
  return new Compiler({
    react: true
  }, (babelOptions, file) => {
    if (file.hmrAvailable() && ReactFastRefresh.babelPlugin) {
      babelOptions.plugins = babelOptions.plugins || [];
      babelOptions.plugins.push(ReactFastRefresh.babelPlugin);
    }
  });
});

Plugin.registerCompiler({
  extensions: ['stories.html'],
  archMatching: 'web',
  isTemplate: true
}, () => new BlazeCompiler(
  "aurorae-blaze",
  TemplatingTools.scanHtmlForTags,
  TemplatingTools.compileTagsWithSpacebars
));

Plugin.registerCompiler({
  extensions: ['stories.svelte'],
}, () => new SvelteCompiler(svelteOptions, preprocessSvelte));
