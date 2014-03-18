// Lint and build CSS
module.exports = function(grunt) {
  grunt.registerTask('default', ['jshint:source', 'less:src']);
  grunt.registerTask('test', ['default', 'karma:test']);
};