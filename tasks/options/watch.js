module.exports = function(config) {
  return {
    css: {
      files: [ '<%= srcDir %>/css/**/*.less' ],
      tasks: ['css'],
      options: {
        spawn: false
      }
    }
  };
};
