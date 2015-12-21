module.exports = function(config) {
  return {
    build: {
      expand: true,
      cwd: '<%= genDir %>',
      src: ['css/*.css', 'vendor/css/*.css'],
      dest: '<%= genDir %>'
    }
  };
};
