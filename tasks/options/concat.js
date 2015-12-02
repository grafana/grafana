module.exports = function(config) {
  "use strict";

  return {
    cssDark: {
      src: [
        '<%= genDir %>/vendor/css/normalize.min.css',
        '<%= genDir %>/vendor/css/timepicker.css',
        '<%= genDir %>/vendor/css/spectrum.css',
        '<%= genDir %>/css/bootstrap.dark.min.css',
        '<%= genDir %>/css/bootstrap-responsive.min.css',
        '<%= genDir %>/vendor/css/font-awesome.min.css'
      ],
      dest: '<%= genDir %>/css/grafana.dark.min.css'
    },
    cssLight: {
      src: [
        '<%= genDir %>/vendor/css/normalize.min.css',
        '<%= genDir %>/vendor/css/timepicker.css',
        '<%= genDir %>/vendor/css/spectrum.css',
        '<%= genDir %>/css/bootstrap.light.min.css',
        '<%= genDir %>/css/bootstrap-responsive.min.css',
        '<%= genDir %>/vendor/css/font-awesome.min.css'
      ],
      dest: '<%= genDir %>/css/grafana.light.min.css'
    },
    js: {
      src: [
        '<%= tempDir %>/vendor/requirejs/require.js',
        '<%= tempDir %>/app/require_config.js',
        '<%= tempDir %>/app/app.js',
      ],
      dest: '<%= genDir %>/app/app.js'
    },
  };
};
