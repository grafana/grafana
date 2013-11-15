module.exports = function(config,grunt) {
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
        'elasticjs',
        'timepicker',
        'datepicker',
        'underscore',
        'filters/all',
        'jquery.flot',
        'services/all',
        'angular-strap',
        'directives/all',
        'jquery.flot.pie',
        'angular-sanitize',
        'angular-dragdrop'
      ]
    }
  ];

  var fs = require('fs');
  var panelPath = config.srcDir+'/app/panels'

  // create a module for each directory in src/app/panels/
  fs.readdirSync(panelPath).forEach(function (panelName) {
    if(!grunt.file.exists(panelPath+'/'+panelName+'/module.js')) {
      fs.readdirSync(panelPath+"/"+panelName).forEach(function (subName) {
        requireModules.push({
          name: 'panels/'+panelName+'/'+subName+'/module',
          exclude: ['app']
        });      })
    } else {
      requireModules.push({
        name: 'panels/'+panelName+'/module',
        exclude: ['app']
      });
    }
  });

  // exclude the literal config definition from all modules
  requireModules
    .forEach(function (module) {
      module.excludeShallow = module.excludeShallow || [];
      module.excludeShallow.push('config');
    });

  return _c;
};
