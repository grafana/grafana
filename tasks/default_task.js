// Lint and build CSS
module.exports = function(grunt) {
  grunt.registerTask('default', ['jscs', 'jshint', 'less:src', 'concat:cssDark', 'concat:cssLight']);
  grunt.registerTask('test', ['default', 'karma:test']);
};
