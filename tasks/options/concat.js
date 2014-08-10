module.exports = function(config) {
  return {
    css: {
      src: [
        '<%= srcDir %>/vendor/normalize.min.css',
        '<%= srcDir %>/vendor/timepicker.css',
        '<%= srcDir %>/vendor/spectrum.css',
        '<%= srcDir %>/vendor/animate.min.css',
        '<%= srcDir %>/css/bootstrap.dark.min.css'
      ],
      dest: '<%= srcDir %>/css/default.min.css'
    },
    js: {
      src: [
        '<%= destDir %>/vendor/require/require.js',
        '<%= destDir %>/app/components/require.config.js',
        '<%= destDir %>/app/app.js',
      ],
      dest: '<%= destDir %>/app/app.js'
    },
  };
};
