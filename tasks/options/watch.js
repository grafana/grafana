module.exports = function(config) {
  return {
    css: {
      files: [ '<%= srcDir %>/less/**/*.less' ],
      tasks: ['css'],
      options: {
        spawn: false
      }
    },

    copy_to_gen: {
      files: ['<%= srcDir %>/**/*', '!<%= srcDir %>/**/*.less'],
      tasks: ['copy:public_to_gen'],
      options: {
        spawn: false
      }
    },

    typescript: {
      files: ['<%= srcDir %>/app/**/*.ts'],
      tasks: ['typescript:build'],
      options: {
        spawn: false
      }
    }

  };
};
