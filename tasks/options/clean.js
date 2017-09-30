module.exports = function(config) {
  'use strict';

  return {
    release: ['<%= destDir %>', '<%= tempDir %>', '<%= genDir %>'],
    build: ['<%= srcDir %>/build'],
    temp: ['<%= tempDir %>'],
    packaging: [
    ],
  };
};
