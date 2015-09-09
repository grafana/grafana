module.exports = function(config) {
  return {
    css: {
      files: [ '<%= srcDir %>/css/**/*.less' ],
      tasks: ['css'],
      options: {
        spawn: false
      }
    },

    app_gen: {
      files: ['<%= srcDir %>/app/**/*.js', '<%= srcDir %>/app/**/*.html'],
      tasks: ['copy:app_gen_build'],
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
