module.exports = function(config) {
  return {
    build: {
      expand: true,
      cwd: '<%= tempDir %>',
      src: '**/*.css',
      dest: '<%= tempDir %>'
    }
  };
};