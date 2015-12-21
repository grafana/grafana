module.exports = function(config) {
  return {
    options: {
      encoding: 'utf8',
      algorithm: 'md5',
      length: 8,
    },
    cssDark: {
      src: '<%= genDir %>/css/grafana.dark.min.css',
      dest: '<%= genDir %>/css'
    },
    cssLight: {
      src: '<%= genDir %>/css/grafana.light.min.css',
      dest: '<%= genDir %>/css'
    },
    js: {
      src: '<%= genDir %>/app/boot.js',
      dest: '<%= genDir %>/app'
    }
  };
};
