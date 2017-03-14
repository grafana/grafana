module.exports = function(config) {
  return {
    options: {
      restructuring: false,
    },
    build: {
      expand: true,
      cwd: '<%= genDir %>',
      src: ['css/*.css', 'vendor/css/*.css'],
      dest: '<%= genDir %>'
    }
  };
};
