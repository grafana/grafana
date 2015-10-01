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
<<<<<<< d59a1575c0293e7357b0d49889067926267e31a0
      tasks: ['copy:everything_but_less'],
>>>>>>> tech(typescript): its looking good
=======
      tasks: [
        'jshint',
        'jscs',
        'tslint',
        'clean:gen',
        'copy:public_to_gen',
        'typescript:build',
        'karma:test'
      ],
>>>>>>> feat(cloudwatch): moved specs into plugins dir
      options: {
        spawn: false
      }
    },

<<<<<<< d59a1575c0293e7357b0d49889067926267e31a0
<<<<<<< c2c5414f721c2b21b957173f2def0a4367a70051
=======
>>>>>>> feat(cloudwatch): moved specs into plugins dir
    // typescript: {
    //   files: ['<%= srcDir %>/app#<{(||)}>#*.ts', '<%= srcDir %>/test#<{(||)}>#*.ts'],
    //   tasks: ['tslint', 'typescript:build'],
    //   options: {
    //     spawn: false
    //   }
    // }
<<<<<<< d59a1575c0293e7357b0d49889067926267e31a0
=======
    typescript: {
      files: ['<%= srcDir %>/app/**/*.ts', '<%= srcDir %>/test/**/*.ts'],
      tasks: ['tslint', 'typescript:build'],
      options: {
        spawn: false
      }
    }
>>>>>>> feat() started work on more feature rich time picker
=======
>>>>>>> feat(cloudwatch): moved specs into plugins dir

  };
};
