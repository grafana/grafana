module.exports = function(grunt) {
  "use strict";

  // build, then zip and upload to s3
  grunt.registerTask('release', [
    'build',
    'compress:zip_release',
    'compress:tgz_release',
  ]);

};
