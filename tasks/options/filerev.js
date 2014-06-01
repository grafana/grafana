module.exports = function(config) {
  return {
    options: {
      encoding: 'utf8',
      algorithm: 'md5',
      length: 8,
    },
    css: {
      src: '<%= destDir %>/css/default.min.css',
      dest: '<%= destDir %>/css'
    },
    js: {
      src: '<%= destDir %>/app/app.js',
      dest: '<%= destDir %>/app'
    }
  };
};
