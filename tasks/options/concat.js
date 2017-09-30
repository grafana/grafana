module.exports = function(config) {
  "use strict";

  return {
    cssDark: {
      src: [
        '<%= srcDir %>/vendor/css/timepicker.css',
        '<%= srcDir %>/vendor/css/spectrum.css',
        '<%= srcDir %>/build/grafana.dark.css',
        '<%= srcDir %>/vendor/css/font-awesome.min.css'
      ],
      dest: '<%= srcDir %>/build/grafana.dark.min.css'
    },

    cssLight: {
      src: [
        '<%= srcDir %>/vendor/css/timepicker.css',
        '<%= srcDir %>/vendor/css/spectrum.css',
        '<%= srcDir %>/build/grafana.light.css',
        '<%= srcDir %>/vendor/css/font-awesome.min.css'
      ],
      dest: '<%= srcDir %>/build/grafana.light.min.css'
    },

    cssFonts: {
      src: ['<%= srcDir %>/build/fonts.css'],
      dest: '<%= srcDir %>/build/fonts.min.css'
    },

  };
};
