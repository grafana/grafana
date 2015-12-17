module.exports = function(config, grunt) {
  'use strict';

  grunt.event.on('watch', function(action, filepath) {
    var newPath;

    grunt.log.writeln('File Changed: ' + filepath);

    if (/(\.html)$/.test(filepath)) {
      newPath = filepath.replace(/^public/, 'public_gen');
      grunt.log.writeln('Copying to ' + newPath);
      grunt.file.copy(filepath, newPath);
    }

    if (/(\.js)$/.test(filepath)) {
      newPath = filepath.replace(/^public/, 'public_gen');
      grunt.log.writeln('Copying to ' + newPath);
      grunt.file.copy(filepath, newPath);

      grunt.task.run('jshint');
      grunt.task.run('jscs');
    }

    if (/(\.less)$/.test(filepath)) {
      grunt.task.run('clean:css');
      grunt.task.run('css');
    }

    if (/(\.ts)$/.test(filepath)) {
      //changes changed file source to that of the changed file
      var option = 'typescript.build.src';
      var result = filepath;
      grunt.config(option, result);
      grunt.task.run('typescript:build');
      grunt.task.run('tslint');
    }
  });

  return {
    copy_to_gen: {
      files: ['<%= srcDir %>/**/*'],
      tasks: [],
      options: {
        spawn: false
      }
    },
  };
};
