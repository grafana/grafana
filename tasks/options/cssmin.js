module.exports = function(config) {
  return {
    build: {
      expand: true,
      cwd: '<%= genDir %>',
      src: '**/*.css',
      dest: '<%= genDir %>'
    }
  };
};
