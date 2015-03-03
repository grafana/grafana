module.exports = function(grunt) {
  "use strict";

  // Concat and Minify the src directory into dist
  grunt.registerTask('build', [
    'jshint:source',
    'jshint:tests',
    'jscs',
    'karma:test',
    'clean:on_start',
    'less:src',
    'concat:cssDark',
    'concat:cssLight',
    'copy:everything_but_less_to_temp',
    'htmlmin:build',
    'ngtemplates',
    'cssmin:build',
    'ngAnnotate:build',
    'requirejs:build',
    'concat:js',
    'filerev',
    'usemin',
    'clean:temp',
    'uglify:dest'
  ]);

  grunt.registerTask('build-post-process', function() {
    grunt.config('copy.dist_to_tmp', {
      expand: true,
      cwd: '<%= destDir %>',
      src: '**/*',
      dest: '<%= tempDir %>/public/',
    });
    grunt.config('clean.dest_dir', ['<%= destDir %>']);
    grunt.config('copy.backend_bin', {
      cwd: 'bin',
      expand: true,
      src: ['grafana'],
      options: { mode: true},
      dest: '<%= tempDir %>'
    });
    grunt.config('copy.backend_files', {
      expand: true,
      src: ['conf/defaults.ini', 'conf/sample.ini', 'vendor/**/*', 'scripts/*'],
      options: { mode: true},
      dest: '<%= tempDir %>'
    });

    grunt.task.run('copy:dist_to_tmp');
    grunt.task.run('clean:dest_dir');
    grunt.task.run('copy:backend_bin');
    grunt.task.run('copy:backend_files');
  });

};
