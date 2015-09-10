module.exports = function(config) {
  'use strict';

  return {
<<<<<<< 1d80184393eeceb8b85607609946c8057b6ef299
    // css: {
    //   files: [ '<%= srcDir %>/less#<{(||)}>#*.less' ],
    //   tasks: ['css'],
    //   options: {
    //     spawn: false
    //   }
    // },

    copy_to_gen: {
      files: ['<%= srcDir %>/**/*'],
      tasks: [
        'clean:gen',
        'copy:public_to_gen',
        'css',
        'typescript:build',
        'jshint',
        'jscs',
        'tslint',
        'karma:test'
      ],
=======
    css: {
      files: [ '<%= srcDir %>/less/**/*.less' ],
      tasks: ['css'],
      options: {
        spawn: false
      }
    },

    copy_to_gen: {
      files: ['<%= srcDir %>/**/*', '!<%= srcDir %>/**/*.less'],
      tasks: ['copy:everything_but_less'],
>>>>>>> tech(typescript): its looking good
      options: {
        spawn: false
      }
    },

    // typescript: {
    //   files: ['<%= srcDir %>/app#<{(||)}>#*.ts', '<%= srcDir %>/test#<{(||)}>#*.ts'],
    //   tasks: ['tslint', 'typescript:build'],
    //   options: {
    //     spawn: false
    //   }
    // }

  };
};
