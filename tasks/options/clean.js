module.exports = function(config) {
  return {
    on_start: ['<%= destDir %>', '<%= tempDir %>'],
    temp: ['<%= tempDir %>']
  };
};
