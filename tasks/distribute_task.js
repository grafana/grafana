module.exports = function(grunt) {
  "use strict";

  // build, then zip and upload to s3
  grunt.registerTask('release', ['build', 'build-post-process','compress:release']);

};
