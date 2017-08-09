module.exports = function(config, grunt) {
  'use strict';

  var gaze = require('gaze');
  var path = require('path');
  var firstRun = true;
  var done;
  var lastTime;

  grunt.registerTask('watch', function() {
    if (!grunt.option('skip-ts-compile')) {
      grunt.log.writeln('We recommoned starting with: grunt watch --force --skip-ts-compile')
      grunt.log.writeln('Then do incremental typescript builds with: grunt exec:tswatch')
    }

    done = this.async();
    lastTime = new Date().getTime();

    if (firstRun === false) {
      grunt.log.writeln('Watch resuming');
      return;
    }

    gaze([
      config.srcDir + '/app/**/*',
      config.srcDir + '/sass/**/*',
    ], function(err, watcher) {

      console.log('Gaze watchers setup');

      watcher.on('all', function(evtName, filepath) {
        filepath = path.relative(process.cwd(), filepath);

        // ignore multiple changes at once
        var now = new Date().getTime();
        if (now - lastTime < 100) {
          return;
        }
        lastTime = now;

        var newPath;
        grunt.log.writeln('File Changed: ', filepath);

        if (/(\.html)|(\.json)$/.test(filepath)) {
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

        if (/(\.scss)$/.test(filepath)) {
          grunt.task.run('clean:css');
          grunt.task.run('css');
        }

        if (/(\.ts)$/.test(filepath)) {
          newPath = filepath.replace(/^public/, 'public_gen');
          grunt.log.writeln('Copying to ' + newPath);
          grunt.file.copy(filepath, newPath);

          if (grunt.option('skip-ts-compile')) {
            grunt.log.writeln('Skipping ts compile, run grunt exec:tswatch to start typescript watcher')
          } else {
            grunt.task.run('exec:tscompile');
          }

          grunt.config('tslint.source.files.src', filepath);
          grunt.task.run('exec:tslintfile');
        }

        done();
        firstRun = false;
        grunt.task.run('watch');
      });
    });
  });
};
