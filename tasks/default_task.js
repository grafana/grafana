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
    'postcss'
    ]
  );

  grunt.registerTask('default', [
    'jscs',
    'jshint',
    'tslint',
    'clean:gen',
    'copy:node_modules',
    'copy:public_to_gen',
    'phantomjs',
    'css',
    'typescript:build'
  ]);

  grunt.registerTask('test', ['default', 'karma:test']);

};
