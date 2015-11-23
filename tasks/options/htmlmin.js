module.exports = function(config) {
  return {
    build: {
      options:{
        removeComments: true,
        collapseWhitespace: true,
        keepClosingSlash: true
      },
      expand: true,
      cwd: '<%= genDir %>',
      src: [
        //'index.html',
        'app/panels/**/*.html',
        'app/partials/**/*.html',
        'plugins/raintank/panels/**/*.html',
        'plugins/raintank/features/**/*.html',
        'plugins/raintank/directives/**/*.html'
      ],
      dest: '<%= genDir %>'
    }
  };
};
