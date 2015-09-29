module.exports = function(config) {
  return {
    on_start: ['<%= destDir %>', '<%= tempDir %>', '<%= windowsDestDir %>'],
    temp: ['<%= tempDir %>'],
    windows: ['<%= windowsDestDir %>'],
  };
};
