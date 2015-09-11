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
        //'index.html',
        'app/panels/**/*.html',
        'app/partials/**/*.html'
      ],
      dest: '<%= genDir %>'
    }
  };
};
