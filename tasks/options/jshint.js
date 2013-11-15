module.exports = function(config) {
  return {
    // just lint the source dir
    source: {
      files: {
        src: ['Gruntfile.js', '<%= srcDir %>/app/**/*.js']
      }
    },
    options: {
      jshintrc: '<%= baseDir %>/.jshintrc',
      ignores: [
        'node_modules/*',
        'dist/*',
        'sample/*',
        '<%= srcDir %>/vendor/*',
        '<%= srcDir %>/app/panels/*/{lib,leaflet}/*'
      ]
    }
  };
};