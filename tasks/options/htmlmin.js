module.exports = function(config) {
  return {
    build: {
      options:{
        removeComments: true,
        collapseWhitespace: true,
        keepClosingSlash: true
      },
      expand: true,
      cwd: '<%= tempDir %>',
      src: [
        //'index.html',
        'app/panels/**/*.html',
        'app/partials/**/*.html',
        'plugins/**/*.html'
      ],
      dest: '<%= tempDir %>'
    }
  };
};