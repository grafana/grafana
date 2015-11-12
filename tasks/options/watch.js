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
        'clean:gen',
        'copy:public_to_gen',
        'css',
        'typescript:build',
        'jshint',
        'jscs',
        'tslint',
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
