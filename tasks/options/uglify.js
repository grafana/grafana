module.exports = function(config) {
  return {
    genDir: {
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
