module.exports = function(config,grunt) {
  'use strict';

  grunt.registerTask('phantomjs', 'Copy phantomjs binary from node', function() {

    var dest = './vendor/phantomjs/phantomjs';
    var confDir = './node_modules/karma-phantomjs-launcher/node_modules/phantomjs/lib/'

    if (!grunt.file.exists(dest)){

      var m=grunt.file.read(confDir+"location.js")
      var src=/= \"([^\"]*)\"/.exec(m)[1];
      
      if (!grunt.file.isPathAbsolute(src)) {
        src = confDir+src;
      }

      var exec = require('child_process').execFileSync;

      try {
        var ph=exec(src,['-v'], { stdio: 'ignore' });
        grunt.verbose.writeln('Using '+ src);
        grunt.file.copy(src, dest, { encoding: null });
      } catch (err) {
        grunt.verbose.writeln(err);
        grunt.fail.warn('No working Phantomjs binary available')
      }
      
    } else {
       grunt.log.writeln('Phantomjs already imported from node');
    }
  });
};
