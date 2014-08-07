module.exports = function(config) {
  return {
    dev: {
      configFile: 'src/test/karma.conf.js',
      singleRun: false,
    },
    debug: {
      configFile: 'src/test/karma.conf.js',
      singleRun: false,
      browsers: ['Chrome']
    },
    test: {
      configFile: 'src/test/karma.conf.js',
    },
    coveralls: {
      configFile: 'src/test/karma.conf.js',
      reporters: ['dots','coverage','coveralls'],
      preprocessors: {
        'src/app/**/*.js': ['coverage']
      },
      coverageReporter: {
        type: 'lcov',
        dir: 'coverage/'
      }
    }
  };
};
