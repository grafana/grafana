module.exports = function(config) {
  'use strict';

  return {
    release: ['<%= destDir %>', '<%= tempDir %>', '<%= genDir %>'],
    gen: ['<%= genDir %>'],
    temp: ['<%= tempDir %>'],
    css: ['<%= genDir %>/css'],
    packaging: [
      '<%= tempDir %>/public/vendor/npm/rxjs',
      '<%= tempDir %>/public/vendor/npm/teather',
      '<%= tempDir %>/public/vendor/npm/teather-drop',
      '<%= tempDir %>/public/**/*.map',
    ],
  };
};
