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
        'ace-builds/src-noconflict/**/*',
        'eventemitter3/*.js',
        'systemjs/dist/*.js',
        'es6-promise/**/*',
        'es6-shim/*.js',
        'reflect-metadata/*.js',
        'reflect-metadata/*.ts',
        'reflect-metadata/*.d.ts',
        'rxjs/**/*',
        'tether/**/*',
        'tether-drop/**/*',
        'tether-drop/**/*',
        'remarkable/dist/*',
        'remarkable/dist/*',
        'virtual-scroll/**/*',
        'mousetrap/**/*',
        'twemoji/2/twemoji.amd*',
        'twemoji/2/svg/*.svg',
      ],
      dest: '<%= srcDir %>/vendor/npm'
    }

  };
};
