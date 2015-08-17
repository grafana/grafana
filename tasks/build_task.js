module.exports = function(grunt) {
  "use strict";

  // Concat and Minify the src directory into dist
  grunt.registerTask('build', [
    'jshint:source',
    'jshint:tests',
    'jscs',
<<<<<<< 63cd3fa1d02047bce8fd0abee69c76bf82a92e44
    'tslint',
    'clean:release',
    'copy:public_to_gen',
    'typescript:build',
    // 'karma:test',
    'phantomjs',
    'css',
=======
    // 'karma:test',
    'clean:on_start',
    'less:src',
    'concat:cssDark',
    'concat:cssLight',
    'copy:everything_but_less_to_temp',
>>>>>>> [OWL-47] Reduce page load time of Grafana
    'htmlmin:build',
    'ngtemplates',
    'cssmin:build',
    'ngAnnotate:build',
    'requirejs:build',
    'concat:js',
    'clean:temp',
    'filerev',
    'remapFilerev',
    'usemin',
    'uglify:genDir'
  ]);

  // task to add [[.AppSubUrl]] to reved path
  grunt.registerTask('remapFilerev', function() {
    var root = grunt.config().genDir;
    var summary = grunt.filerev.summary;
    var fixed = {};

    for(var key in summary){
      if(summary.hasOwnProperty(key)){
        var orig = key.replace(root, root+'/[[.AppSubUrl]]');
        var revved = summary[key].replace(root, root+'/[[.AppSubUrl]]');
        fixed[orig] = revved;
      }
    }

    grunt.filerev.summary = fixed;
  });

  grunt.registerTask('build-post-process', function() {
    grunt.config('copy.public_gen_to_temp', {
      expand: true,
      cwd: '<%= genDir %>',
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
      src: ['conf/defaults.ini', 'conf/sample.ini', 'vendor/**/*', 'scripts/*'],
      options: { mode: true},
      dest: '<%= tempDir %>'
    });

    grunt.task.run('copy:public_gen_to_temp');
    grunt.task.run('copy:backend_bin');
    grunt.task.run('copy:backend_files');
  });

};
