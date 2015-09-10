module.exports = function(grunt) {
  "use strict";

  // Concat and Minify the src directory into dist
  grunt.registerTask('build', [
    'jshint:source',
    'jshint:tests',
    'jscs',
    'clean:on_start',
    'copy:app_gen_build',
    'typescript:build',
    'karma:test',
    'css',
    'copy:everything_but_less_to_temp',
    'htmlmin:build',
    'ngtemplates',
    'cssmin:build',
    'ngAnnotate:build',
    'requirejs:build',
    'concat:js',
    'filerev',
    'remapFilerev',
    'usemin',
    'clean:temp',
    'uglify:dest'
  ]);

  // task to add [[.AppSubUrl]] to reved path
  grunt.registerTask('remapFilerev', function(){
    var root = grunt.config().destDir;
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

    grunt.task.run('copy:dist_to_tmp');
    grunt.task.run('clean:dest_dir');
    grunt.task.run('copy:backend_bin');
    grunt.task.run('copy:backend_files');
  });

};
