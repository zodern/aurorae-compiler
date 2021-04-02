const ext = 'stories.js';

class Compiler extends BabelCompiler {
  // Overrides processFilesForTarget to make added javascript not lazy
  processFilesForTarget(inputFiles) {
    var compiler = this;
    
    // Reset this cache for each batch processed.
    this._babelrcCache = null;

    inputFiles.forEach(function (inputFile) {
      var path = inputFile.getPathInPackage();
      var inNodeModules = path.startsWith('node_modules/') || path.includes('/node_modules/');
      var isProd = process.env.NODE_ENV === 'production';

      if (isProd && !inNodeModules) {
        // prevent file from being included in production
        // Except for files in node_modules since they should be included
        // if they are imported
        return;
      }

      if (inputFile.supportsLazyCompilation) {
        inputFile.addJavaScript({
          path: inputFile.getPathInPackage(),
          bare: !!inputFile.getFileOptions().bare,
          // If the file is in node_modules, only include if the file is imported
          lazy: inNodeModules || !inputFile.getPathInPackage().endsWith(`.${ext}`),
        }, function () {
          return compiler.processOneFileForTarget(inputFile);
        });
      } else {
        var toBeAdded = compiler.processOneFileForTarget(inputFile);
        if (toBeAdded) {
          inputFile.addJavaScript(toBeAdded);
        }
      }
    });
  }
}

Plugin.registerCompiler({
  extensions: [ext],
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
