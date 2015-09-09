module.exports = function() {
  'use strict';

  return {
    base: {
      src: ['public/app/**/*.ts'],
      dest: '',
      options: {
        module: 'amd', //or commonjs
        target: 'es5', //or es3
        keepDirectoryHierarchy: true,
        declaration: true,
        watch: true,
        sourceMap: true,
      }
    }
  };

};
