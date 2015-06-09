module.exports = function(config) {
  return {
    source: {
      files: {
        src: ['Gruntfile.js', '<%= srcDir %>/app/**/*.js', '<%= srcDir %>/plugins/raintank/**/*.js'],
      }
    },
    tests: {
      files: {
        src: ['<%= srcDir %>/test/**/*.js'],
      }
    },
    options: {
      jshintrc: true,
      reporter: require('jshint-stylish'),
      ignores: [
        'node_modules/*',
        'dist/*',
        'sample/*',
        '<%= srcDir %>/vendor/*',
        '<%= srcDir %>/app/panels/*/{lib,leaflet}/*',
        '<%= srcDir %>/app/dashboards/*'
      ]
    }
  };
};
