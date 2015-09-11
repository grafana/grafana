module.exports = function(config) {
  return {
    build: {
      expand: true,
      cwd:'<%= genDir %>',
      src: [
        'app/controllers/**/*.js',
        'app/plugins/**/*.js',
        'app/directives/**/*.js',
        'app/services/**/*.js',
        'app/filters/**/*.js',
        'app/features/**/*.js',
        'app/panels/**/*.js',
        'app/routes/**/*.js',
        'app/app.js',
        'vendor/angular/**/*.js',
      ],
      dest: '<%= genDir %>'
    }
  };
};
