// Lint and build CSS
module.exports = function(grunt) {
  grunt.registerTask('default', ['jshint:source', 'jshint:tests', 'less:src']);
  grunt.registerTask('test', ['default', 'karma:test']);
};