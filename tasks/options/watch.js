module.exports = function(config) {
  'use strict';

  return {
<<<<<<< dda08978836d7bcaa3f0bf6cde71161a86895386
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
