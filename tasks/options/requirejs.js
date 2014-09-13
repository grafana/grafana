module.exports = function(config,grunt) {
  'use strict';

  var _c = {
    build: {
      options: {
        appDir: '<%= tempDir %>',
        dir: '<%= destDir %>',

        mainConfigFile: '<%= tempDir %>/app/components/require.config.js',
        modules: [], // populated below

        optimize: 'none',
        optimizeCss: 'none',
        optimizeAllPluginResources: false,

        paths: { config: '../config.sample' }, // fix, fallbacks need to be specified

        removeCombined: true,
        findNestedDependencies: true,
        normalizeDirDefines: 'all',
        inlineText: true,
        skipPragmas: true,

        done: function (done, output) {
          var duplicates = require('rjs-build-analysis').duplicates(output);

          if (duplicates.length > 0) {
            grunt.log.subhead('Duplicates found in requirejs build:');
            grunt.log.warn(duplicates);
            done(new Error('r.js built duplicate modules, please check the excludes option.'));
          }

          done();
        }
      }
    }
  };

  // setup the modules require will build
  var requireModules = _c.build.options.modules = [
    {
      // main/common module
      name: 'app',
      include: [
        'css',
        'kbn',
        'text',
        'jquery',
        'angular',
        'settings',
        'bootstrap',
        'modernizr',
        'timepicker',
        'datepicker',
        'lodash',
        'filters/all',
        'jquery.flot',
        'services/all',
        'angular-strap',
        'directives/all',
        'jquery.flot.pie',
        'angular-dragdrop',
        'controllers/all',
        'routes/all',
        'components/partials',
      ]
    }
  ];

  var fs = require('fs');
  var panelPath = config.srcDir+'/app/panels';

  // create a module for each directory in src/app/panels/
  fs.readdirSync(panelPath).forEach(function (panelName) {
    requireModules[0].include.push('panels/'+panelName+'/module');
    requireModules[0].include.push('text!panels/'+panelName+'/module.html');
  });

  // exclude the literal config definition from all modules
  requireModules
    .forEach(function (module) {
      module.excludeShallow = module.excludeShallow || [];
      module.excludeShallow.push('config');
    });

  return _c;
};
