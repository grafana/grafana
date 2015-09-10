module.exports = function(config) {
  return {
    dest: {
      expand: true,
      src: ['**/*.js', '!dashboards/*.js', '!vendor/**/*.js'],
      dest: '<%= genDir %>',
      cwd: '<%= genDir %>',
      options: {
        quite: true,
        compress: {},
        preserveComments: false,
        banner: '<%= meta.banner %>'
      }
    }
  };
};
