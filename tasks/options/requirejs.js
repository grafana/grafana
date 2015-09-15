module.exports = function(config,grunt) {
  'use strict';

  function buildRequireJsOptions() {

    var options = {
<<<<<<< 1d80184393eeceb8b85607609946c8057b6ef299
      appDir: '<%= genDir %>',
      dir:  '<%= tempDir %>',
      mainConfigFile: '<%= genDir %>/app/components/require.config.js',
      baseUrl: './',
=======
      appDir: '<%= tempDir %>',
      dir:  '<%= destDir %>',
      mainConfigFile: '<%= tempDir %>/app/components/require.config.js',
      baseUrl: 'app_gen',
>>>>>>> tech(typescript): its looking good
      waitSeconds: 0,

      modules: [], // populated below,

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
    };

    // setup the modules require will build
    var requireModules = options.modules = [
      {
        // main/common module
<<<<<<< 1d80184393eeceb8b85607609946c8057b6ef299
        name: 'app/app',
=======
        name: 'app',
>>>>>>> tech(typescript): its looking good
        include: [
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
          'jquery.flot',
          'angular-strap',
          'angular-dragdrop',
<<<<<<< d63b2540f5db1d3c15c625f00bbb075a168bc933
          'app/core/core',
          'app/services/all',
          'app/features/all',
          'app/controllers/all',
          'app/components/partials',
=======
          'core/core',
          'services/all',
          'features/all',
          'controllers/all',
          'components/partials',
>>>>>>> refactor: moving routes into core, improved bundle loader
          // bundle the datasources
          'app/plugins/datasource/grafana/datasource',
          'app/plugins/datasource/graphite/datasource',
          'app/plugins/datasource/influxdb/datasource',
        ]
      },
<<<<<<< 1d80184393eeceb8b85607609946c8057b6ef299
=======
      // {
      //   name: 'features/org/all',
      //   exclude: ['app'],
      // }
>>>>>>> tech(typescript): its looking good
    ];

    var fs = require('fs');
    var panelPath = config.srcDir + '/app/panels';

    // create a module for each directory in public/app/panels/
    fs.readdirSync(panelPath).forEach(function (panelName) {
      requireModules[0].include.push('app/panels/'+panelName+'/module');
    });

    return { options: options };
  }

  return { build: buildRequireJsOptions() };
};
