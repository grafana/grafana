module.exports = function() {
  'use strict';

  return {
    build: {
      src: ['public/app/**/*.ts'],
      dest: 'public/.app_gen',
      options: {
        module: 'amd', //or commonjs
        target: 'es5', //or es3
        rootDir: 'public/app',
        declaration: true,
        sourceMap: true,
        generateTsConfig: true,
      }
    },
    watch: {
      src: ['public/app/**/*.ts'],
      dest: 'public/.app_gen',
      options: {
        module: 'amd', //or commonjs
        target: 'es5', //or es3
        rootDir: 'public/app',
        declaration: true,
        sourceMap: true,
        watch: true,
        generateTsConfig: true,
      }
    }
  };

};
