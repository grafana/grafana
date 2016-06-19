module.exports = function(config) {
  return {
    build: {
      options:{
        removeComments: true,
        collapseWhitespace: true
      },
      expand: true,
      cwd: '<%= genDir %>',
      src: [
        'app/**/*.html',
      ],
      dest: '<%= genDir %>'
    }
  };
};
