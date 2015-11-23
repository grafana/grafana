module.exports = function(config) {
  return {
    build: {
      expand: true,
      cwd:'<%= genDir %>',
      src: [
        'app/**/*.js',
        'plugins/**/*.js'
      ],
      dest: '<%= genDir %>'
    }
  };
};
