module.exports = function(config, grunt) {
  'use strict';

  var gaze = require('gaze');
  var path = require('path');
  var firstRun = true;
  var done;
  var lastTime;

  grunt.registerTask('watch', function() {
    done = this.async();
    lastTime = new Date().getTime();

    if (firstRun === false) {
      grunt.log.writeln('Watch resuming');
      return;
    }

    gaze([
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

        if (/(\.scss)$/.test(filepath)) {
          grunt.task.run('clean:css');
          grunt.task.run('css');
        }

        done();
        firstRun = false;
        grunt.task.run('watch');
      });
    });
  });
};
