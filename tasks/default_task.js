// Lint and build CSS
module.exports = function(grunt) {
  'use strict';

  grunt.registerTask('css', [
    'sass',
    'concat:cssDark',
    'concat:cssLight',
    'concat:cssFonts',
    'styleguide',
    'sasslint',
    'postcss',
    ]
  );

  grunt.registerTask('default', [
    'clean:gen',
    'jscs',
    'jshint',
    'copy:node_modules',
    'copy:public_to_gen',
    'exec:tslint',
    'phantomjs',
    'css',
    'exec:tscompile'
  ]);

  grunt.registerTask('test', ['default', 'karma:test', 'no-only-tests']);

  grunt.registerTask('no-only-tests', function() {
    var files = grunt.file.expand('public/**/*_specs\.ts', 'public/**/*_specs\.js');

    files.forEach(function(spec) {
      var rows = grunt.file.read(spec).split('\n');
      rows.forEach(function(row) {
        if (row.indexOf('.only(') > 0) {
          grunt.log.errorlns(row);
          grunt.fail.warn('found only statement in test: ' + spec)
        }
      });
    });
  });
};
