module.exports = function(config) {
  return {
    // copy source to temp, we will minify in place for the dist build
    everything_but_less_to_temp: {
      cwd: '<%= srcDir %>',
      expand: true,
      src: ['**/*', '!**/*.less'],
      dest: '<%= tempDir %>'
    },

<<<<<<< 1d80184393eeceb8b85607609946c8057b6ef299
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
