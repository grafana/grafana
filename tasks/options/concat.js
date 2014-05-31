module.exports = function(config) {
  return {
    css: {
      src: [
        '<%= srcDir %>/css/normalize.min.css', 
        '<%= srcDir %>/css/bootstrap.dark.min.css', 
        '<%= srcDir %>/css/timepicker.css', 
        '<%= srcDir &>/css/spectrum.css',
        '<%= srcDir &>/css/animate.min.css'
      ],
      dest: '<%= srcDir %>/css/default.min.css'
    },
  };
};
