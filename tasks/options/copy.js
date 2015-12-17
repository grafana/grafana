module.exports = function(config) {
  return {
    // copy source to temp, we will minify in place for the dist build
    everything_but_less_to_temp: {
      cwd: '<%= srcDir %>',
      expand: true,
      src: ['**/*', '!**/*.less'],
      dest: '<%= tempDir %>'
    },

    public_to_gen: {
      cwd: '<%= srcDir %>',
      expand: true,
      src: ['**/*', '!**/*.less'],
      dest: '<%= genDir %>'
    },

    node_modules: {
      cwd: './node_modules',
      expand: true,
      src: [
        'angular2/**/*',
        'systemjs/**/*',
        'es6-promise/**/*',
        'es6-shim/**/*',
        'reflect-metadata/**/*',
        'rxjs/**/*',
        'zone/**/*',
      ],
      dest: '<%= srcDir %>/vendor/npm'
    }

  };
};
