module.exports = function(grunt) {

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
    'ngmin:build',
    'requirejs:build',
    'concat:js',
    'filerev',
    'usemin',
    'clean:temp',
    'uglify:dest'
  ]);


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
