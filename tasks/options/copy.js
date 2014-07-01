module.exports = function(config) {
  return {
    // copy source to temp, we will minify in place for the dist build
    everything_but_less_to_temp: {
      cwd: '<%= srcDir %>',
      expand: true,
      src: ['**/*', '!**/*.less', '!config.js'],
      dest: '<%= tempDir %>'
    },
    oss: {
    	cwd: 'grafana/src',
    	expand: true,
    	src: [
        '**/*',
        '!app/routes/**',
        '!config.js',
        '!app/app.js',
        '!index.html'
      ],
    	dest: 'public'
    }
  };
};