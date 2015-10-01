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
<<<<<<< d7f7803cdfa8bbb58f83202942e40706b7a5cb87
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

<<<<<<< d7f7803cdfa8bbb58f83202942e40706b7a5cb87
<<<<<<< 07d3105067bfce4cc18a59f70da160bb1d3907e6
=======
>>>>>>> feat(cloudwatch): moved specs into plugins dir
    // typescript: {
    //   files: ['<%= srcDir %>/app#<{(||)}>#*.ts', '<%= srcDir %>/test#<{(||)}>#*.ts'],
    //   tasks: ['tslint', 'typescript:build'],
    //   options: {
    //     spawn: false
    //   }
    // }
<<<<<<< d7f7803cdfa8bbb58f83202942e40706b7a5cb87
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
