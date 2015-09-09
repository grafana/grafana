module.exports = function(config) {
  return {
    // copy source to temp, we will minify in place for the dist build
    everything_but_less_to_temp: {
      cwd: '<%= srcDir %>',
      expand: true,
      src: ['**/*', '!**/*.less'],
      dest: '<%= tempDir %>'
    },

    app_gen_build: {
      cwd: '<%= srcDir %>/app',
      expand: true,
      src: ['**/*.js', '**/*.html'],
      dest: '<%= srcDir %>/app_gen'
    }

  };
};
