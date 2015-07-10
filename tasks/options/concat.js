module.exports = function(config) {
  "use strict";

  return {
    cssDark: {
      src: [
        '<%= srcDir %>/vendor/css/normalize.min.css',
        '<%= srcDir %>/vendor/css/timepicker.css',
        '<%= srcDir %>/vendor/css/spectrum.css',
        '<%= srcDir %>/css/bootstrap.dark.min.css',
        '<%= srcDir %>/css/bootstrap-responsive.min.css',
        '<%= srcDir %>/vendor/css/font-awesome.min.css'
      ],
      dest: '<%= srcDir %>/css/grafana.dark.min.css'
    },
    cssLight: {
      src: [
        '<%= srcDir %>/vendor/css/normalize.min.css',
        '<%= srcDir %>/vendor/css/timepicker.css',
        '<%= srcDir %>/vendor/css/spectrum.css',
        '<%= srcDir %>/css/bootstrap.light.min.css',
        '<%= srcDir %>/css/bootstrap-responsive.min.css',
        '<%= srcDir %>/vendor/css/font-awesome.min.css'
      ],
      dest: '<%= srcDir %>/css/grafana.light.min.css'
    },

    js: {
      src: [
        '<%= destDir %>/vendor/requirejs/require.js',
        '<%= destDir %>/app/components/require.config.js',
        '<%= destDir %>/app/app.js',
      ],
      dest: '<%= destDir %>/app/app.js'
    },
  };
};
