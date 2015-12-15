module.exports = function() {
  'use strict';

  return {
    build: {
      src: ['public/**/*.ts', 'public/test/**/*.ts', "!public/vendor/**/*.ts"],
      dest: 'public_gen/',
      options: {
        module: 'system', //or commonjs
        target: 'es5', //or es3
        rootDir: 'public/',
        sourceRoot: 'public/',
        declaration: true,
        emitDecoratorMetadata: true,
        experimentalDecorators: true,
        sourceMap: true,
        noImplicitAny: false,
      }
    },

    // build2: {
    //   src: ['public/app/alerting#<{(||)}>#*.ts'],
    //   dest: 'public/.app_gen/alerting/all.js',
    //   options: {
    //     target: 'es5', //or es3
    //     declaration: true,
    //     sourceMap: true,
    //   }
    // },

    watch: {
      src: ['public/app/**/*.ts'],
      dest: 'public/app_gen',
      options: {
        module: 'amd', //or commonjs
        target: 'es5', //or es3
        rootDir: 'public/app',
        declaration: true,
        sourceMap: true,
        watch: true,
      }
    }
  };

};
