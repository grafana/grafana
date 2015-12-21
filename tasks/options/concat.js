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
        '<%= genDir %>/vendor/npm/es6-shim/es6-shim.js',
        '<%= genDir %>/vendor/npm/es6-promise/es6-promise.js',
        '<%= genDir %>/vendor/npm/systemjs/dist/system.js',
        '<%= genDir %>/app/system.conf.js',
        '<%= genDir %>/app/boot.js',
      ],
      dest: '<%= genDir %>/app/boot.js'
    },

    bundle_and_boot: {
      src: [
        '<%= genDir %>/app/app_bundle.js',
        '<%= genDir %>/app/boot.js',
      ],
      dest: '<%= genDir %>/app/boot.js'
    },
  };
};
