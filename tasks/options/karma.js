module.exports = function(config) {
  return {
    dev: {
      configFile: '<%= srcDir %>/test/karma.conf.js',
      singleRun: false,
    },
    debug: {
      configFile: '<%= srcDir %>/test/karma.conf.js',
      singleRun: false,
      browsers: ['Chrome']
    },
    test: {
      configFile: '<%= srcDir %>/test/karma.conf.js',
    },
    coveralls: {
      configFile: '<%= srcDir %>/test/karma.conf.js',
      reporters: ['dots','coverage','coveralls'],
      preprocessors: {
        'public/app/**/*.js': ['coverage']
      },
      coverageReporter: {
        type: 'lcov',
        dir: 'coverage/'
      }
    }
  };
};
