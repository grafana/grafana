module.exports = function(config) {
  return {
    build: {
      expand: true,
      cwd:'<%= genDir %>',
      src: [
        'app/**/*.js',
      ],
      dest: '<%= genDir %>'
    }
  };
};
