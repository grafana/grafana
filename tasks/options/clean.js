module.exports = function(config) {
  'use strict';

  return {
    release: ['<%= destDir %>', '<%= tempDir %>', '<%= genDir %>'],
    gen: ['<%= genDir %>'],
    temp: ['<%= tempDir %>'],
    css: ['<%= genDir %>/css'],
    packaging: [
      '<%= tempDir %>/public/vendor/npm/rxjs',
      '<%= tempDir %>/public/vendor/npm/tether',
      '<%= tempDir %>/public/vendor/npm/tether-drop',
      '<%= tempDir %>/public/**/*.map',
      '<%= tempDir %>/public/**/*.ts',
    ],
  };
};
