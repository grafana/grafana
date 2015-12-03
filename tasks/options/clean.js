module.exports = function(config) {
  'use strict';

  return {
    release: ['<%= destDir %>', '<%= tempDir %>', '<%= genDir %>'],
    gen: ['<%= genDir %>'],
    temp: ['<%= tempDir %>']
  };
};
