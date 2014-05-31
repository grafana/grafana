module.exports = function(grunt) {

  // Concat and Minify the src directory into dist
  grunt.registerTask('build', [
    'jshint:source',
    'jshint:tests',
    'clean:on_start',
    'less:src',
    'concat:css',
    'copy:everything_but_less_to_temp',
    'htmlmin:build',
    'ngtemplates:app',
    'cssmin:build',
    'ngmin:build',
    'requirejs:build',
    'filerev',
    'clean:temp',
    'build:write_revision',
    'uglify:dest'
  ]);

  // run a string replacement on the require config, using the latest revision number as the cache buster
  grunt.registerTask('build:write_revision', function() {
    grunt.event.once('git-describe', function (desc) {

      grunt.config('string-replace.config', {
        files: {
          '<%= destDir %>/app/components/require.config.js': '<%= destDir %>/app/components/require.config.js',
          '<%= destDir %>/app/app.js': '<%= destDir %>/app/app.js'
        },
        options: {
          replacements: [
            {
              pattern: /@REV@/g,
              replacement: desc.object
            },
            {
              pattern: /@grafanaVersion@/g,
              replacement: '<%= pkg.version %>'
            }
          ]
        }
      });
      grunt.task.run('string-replace:config');
    });
    grunt.task.run('git-describe');
  });
};
