module.exports = function(config) {
  return {
    dest: {
      expand: true,
      src: ['**/*.js', '!dashboards/*.js', '!vendor/jquery/**/*.js'],
      dest: '<%= destDir %>',
      cwd: '<%= destDir %>',
      options: {
        quite: true,
        compress: {},
        preserveComments: false,
        banner: '<%= meta.banner %>'
      }
    }
  };
};
