module.exports = function(grunt) {
  "use strict";

  // Concat and Minify the src directory into dist
  grunt.registerTask('build', [
    'jshint:source',
    'jshint:tests',
    'karma:test',
    'clean:on_start',
    'less:src',
    'concat:cssDark',
    'concat:cssLight',
    'copy:everything_but_less_to_temp',
    'htmlmin:build',
    'ngtemplates',
    'cssmin:build',
    'build:grafanaVersion',
    'ngAnnotate:build',
    'requirejs:build',
    'concat:js',
    'filerev',
    'usemin',
    'clean:temp',
    //'uglify:dest'
  ]);

  grunt.registerTask('build-post-process', function() {
    var mode = grunt.config.get('mode');
    if (mode === 'backend') {
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
        src: ['conf/grafana.ini', 'vendor/**/*'],
        options: { mode: true},
        dest: '<%= tempDir %>'
      });
      grunt.task.run('copy:dist_to_tmp');
      grunt.task.run('clean:dest_dir');
      grunt.task.run('copy:backend_bin');
      grunt.task.run('copy:backend_files');
    }
  });

  grunt.registerTask('build:grafanaVersion', function() {
    grunt.config('string-replace.config', {
      files: {
        '<%= tempDir %>/app/app.js': '<%= tempDir %>/app/app.js'
      },
      options: {
        replacements: [{ pattern: /@grafanaVersion@/g,  replacement: '<%= pkg.version %>' }]
      }
    });
    grunt.task.run('string-replace:config');
  });

};
