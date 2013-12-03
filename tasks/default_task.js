// Lint and build CSS
module.exports = function(grunt) {
  grunt.registerTask('default', ['docs','jshint:source', 'less:src']);
};