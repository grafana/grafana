module.exports = function(config) {
  return {
    kibana: {
      cwd:  '<%= tempDir %>',
      src:  'app/**/*.html',
      dest: '<%= tempDir %>/app/components/partials.js',
    }
  };
};