module.exports = function(config) {
  return {
    options: {
      restructuring: false,
    },
    build: {
      expand: true,
      cwd: '<%= srcDir %>',
      src: ['build/*.css'],
      dest: '<%= srcDir %>'
    }
  };
};
