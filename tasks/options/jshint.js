module.exports = function(config) {
  return {
    // just lint the source dir
    source: {
      files: {
        src: ['Gruntfile.js', '<%= srcDir %>/app/**/*.js']
      }
    },
    options: {
      jshintrc: '.jshintrc'
    }
  };
};