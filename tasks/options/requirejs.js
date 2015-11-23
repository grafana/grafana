module.exports = function(config,grunt) {
  'use strict';

  function buildRequireJsOptions() {

    var options = {
      appDir: '<%= genDir %>',
      dir:  '<%= tempDir %>',
      mainConfigFile: '<%= genDir %>/app/require_config.js',
      baseUrl: './',
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
        name: 'app/app',
        include: [
          'text',
          'jquery',
          'bootstrap',
          'modernizr',
          'timepicker',
          'datepicker',
          'jquery.flot',
          'angular-strap',
          'angular-dragdrop',
          'app/core/core',
          'app/features/all',
          // bundle the datasources
          'app/plugins/datasource/grafana/datasource',
          'app/plugins/datasource/graphite/datasource',
          'app/plugins/datasource/elasticsearch/datasource',
          'app/plugins/datasource/influxdb/datasource',
          'plugins/raintank/all'
        ]
      },
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
