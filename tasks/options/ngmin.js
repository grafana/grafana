module.exports = function(config) {
  return {
    build: {
      expand:true,
      cwd:'<%= tempDir %>',
      src: [
        'app/controllers/**/*.js',
        'app/directives/**/*.js',
        'app/services/**/*.js',
        'app/filters/**/*.js',
        'app/panels/**/*.js',
        'app/app.js',
        'vendor/angular/**/*.js',
        'vendor/elasticjs/elastic-angular-client.js'
      ],
      dest: '<%= tempDir %>'
    }
  };
};