module.exports = function(grunt) {
  "use strict";

  // Concat and Minify the src directory into dist
  grunt.registerTask('build', [
    'jshint:source',
    'jshint:tests',
    'jscs',
<<<<<<< 1d80184393eeceb8b85607609946c8057b6ef299
<<<<<<< 715feb1cc233716c1a7eb4a10a87d86e2ca2af24
    'tslint',
    'clean:release',
    'copy:public_to_gen',
    'typescript:build',
    // 'karma:test',
    'phantomjs',
    'css',
=======
    // 'karma:test',
=======
>>>>>>> tech(typescript): its looking good
    'clean:on_start',
    'copy:app_gen_build',
    'typescript:build',
    'karma:test',
    'css',
    'copy:everything_but_less_to_temp',
>>>>>>> [OWL-47] Reduce page load time of Grafana
    'htmlmin:build',
    'ngtemplates',
    'cssmin:build',
    'ngAnnotate:build',
<<<<<<< 8b37b131c51c65a4c2ac87c935f95a55bf99256f
    'requirejs:build',
    'concat:js',
    'clean:temp',
    'filerev',
    'remapFilerev',
    'usemin',
    'uglify:genDir'
=======
    // 'requirejs:build',
    // 'concat:js',
    // 'clean:temp',
    // 'filerev',
    // 'remapFilerev',
    // 'usemin',
    // 'clean:temp',
    // 'uglify:genDir'
>>>>>>> tech(typescript): converted signup controller to typescript
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
