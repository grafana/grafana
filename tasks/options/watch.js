module.exports = function(config) {
  'use strict';

  return {
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
        'jshint',
        'jscs',
        'tslint',
        'clean:gen',
        'copy:public_to_gen',
        'css',
        'typescript:build',
        'karma:test'
      ],
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
