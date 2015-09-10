module.exports = function(config,grunt) {
  'use strict';

  function buildRequireJsOptions() {

    var options = {
      appDir: '<%= genDir %>',
      dir:  '<%= tempDir %>',
      mainConfigFile: '<%= genDir %>/app/components/require.config.js',
      baseUrl: 'app',
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
        name: 'app',
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
          'services/all',
          'features/all',
          'directives/all',
          'filters/all',
          'controllers/all',
          'routes/all',
          'components/partials',
          // bundle the datasources
          'plugins/datasource/grafana/datasource',
          'plugins/datasource/graphite/datasource',
          'plugins/datasource/influxdb_08/datasource',
        ]
      },
      // {
      //   name: 'features/org/all',
      //   exclude: ['app'],
      // }
    ];

    var fs = require('fs');
    var panelPath = config.srcDir + '/app/panels';

    // create a module for each directory in public/app/panels/
    fs.readdirSync(panelPath).forEach(function (panelName) {
      requireModules[0].include.push('panels/'+panelName+'/module');
    });

    return { options: options };
  }

  return { build: buildRequireJsOptions() };
};
