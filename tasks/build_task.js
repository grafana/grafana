var path = require('path');

module.exports = function(grunt) {
  "use strict";

  // Concat and Minify the src directory into dist
  grunt.registerTask('build', [
    'jshint:source',
    'jshint:tests',
    'jscs',
    'clean:release',
    'copy:public_to_gen',
    'karma:test',
    'phantomjs',
    'css',
    'htmlmin:build',
    'cssmin:build',
    'exec:webpack-prod',
    'filerev',
    'remapFilerev',
    'usemin',
    'uglify:genDir'
  ]);

  grunt.registerTask('build-post-process', function() {
    grunt.config('copy.public_to_temp', {
      expand: true,
      cwd: '<%= srcDir %>',
      src: '**/*',
      dest: '<%= tempDir %>/public/',
    });
    grunt.config('copy.backend_bin', {
      cwd: 'bin',
      expand: true,
      src: ['*'],
      options: { mode: true},
      dest: '<%= tempDir %>/bin/'
    });
    grunt.config('copy.backend_files', {
      expand: true,
      src: ['conf/*', 'vendor/phantomjs/*', 'scripts/*'],
      options: { mode: true},
      dest: '<%= tempDir %>'
    });

    grunt.task.run('copy:public_to_temp');
    grunt.task.run('copy:backend_bin');
    grunt.task.run('copy:backend_files');

    grunt.file.write(path.join(grunt.config('tempDir'), 'VERSION'), grunt.config('pkg.version'));
  });

};
