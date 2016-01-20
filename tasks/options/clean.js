module.exports = function(config) {
  'use strict';

  return {
    on_start: ['<%= destDir %>', '<%= tempDir %>', '<%= windowsDestDir %>'],
    temp: ['<%= tempDir %>'],
    windows: ['<%= windowsDestDir %>'],
    release: ['<%= destDir %>', '<%= tempDir %>', '<%= genDir %>'],
    gen: ['<%= genDir %>']
  };
};
