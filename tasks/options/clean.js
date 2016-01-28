module.exports = function(config) {
  'use strict';

  return {
    on_start: ['<%= destDir %>', '<%= tempDir %>', '<%= windowsDestDir %>'],
    windows: ['<%= windowsDestDir %>'],
    release: ['<%= destDir %>', '<%= tempDir %>', '<%= genDir %>'],
    gen: ['<%= genDir %>'],
    temp: ['<%= tempDir %>'],
    css: ['<%= genDir %>/css']
  };
};
