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
        'angular2/bundles/*.js',
        'angular2/*.d.ts',
        'systemjs/dist/*.js',
        'es6-promise/**/*',
        'es5-shim/*.js',
        'es6-shim/*.js',
        'reflect-metadata/*.js',
        'reflect-metadata/*.ts',
        'reflect-metadata/*.d.ts',
        'rxjs/bundles/*.js',
        'rxjs/Rx.d.ts',
      ],
      dest: '<%= srcDir %>/vendor/npm'
    }

  };
};
