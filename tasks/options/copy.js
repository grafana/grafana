module.exports = function(config) {
  return {
    // copy source to temp, we will minify in place for the dist build
    everything_but_less_to_temp: {
      cwd: '<%= srcDir %>',
      expand: true,
      src: ['**/*', '!**/*.less'],
      dest: '<%= tempDir %>'
    },

<<<<<<< dda08978836d7bcaa3f0bf6cde71161a86895386
    public_to_gen: {
=======
    everything_but_less: {
>>>>>>> tech(typescript): its looking good
      cwd: '<%= srcDir %>',
      expand: true,
      src: ['**/*', '!**/*.less'],
      dest: '<%= genDir %>'
    }

  };
};
