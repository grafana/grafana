module.exports = function(config) {
  return {
    options: {
      encoding: 'utf8',
      algorithm: 'md5',
      length: 8,
    },
    cssDark: {
      src: '<%= destDir %>/css/grafana.dark.min.css',
      dest: '<%= destDir %>/css'
    },
    cssLight: {
      src: '<%= destDir %>/css/grafana.light.min.css',
      dest: '<%= destDir %>/css'
    },
    js: {
      src: '<%= destDir %>/app/app.js',
      dest: '<%= destDir %>/app'
    }
  };
};
