module.exports = function(config) {
  "use strict";

  return {
    cssDark: {
      src: [
        '<%= genDir %>/vendor/css/timepicker.css',
        '<%= genDir %>/vendor/css/spectrum.css',
        '<%= genDir %>/css/grafana.dark.css',
        '<%= genDir %>/vendor/css/font-awesome.min.css'
      ],
      dest: '<%= genDir %>/css/grafana.dark.min.css'
    },

    cssLight: {
      src: [
        '<%= genDir %>/vendor/css/timepicker.css',
        '<%= genDir %>/vendor/css/spectrum.css',
        '<%= genDir %>/css/grafana.light.css',
        '<%= genDir %>/vendor/css/font-awesome.min.css'
      ],
      dest: '<%= genDir %>/css/grafana.light.min.css'
    },

    cssFonts: {
      src: ['<%= genDir %>/css/fonts.css'],
      dest: '<%= genDir %>/css/fonts.min.css'
    },

  };
};
