module.exports = function(config) {
  return {
    dev: {
      configFile: 'src/test/karma.conf.js',
      singleRun: false,
      browsers: ['PhantomJS']
    },
    debug: {
      configFile: 'src/test/karma.conf.js',
      singleRun: false,
      browsers: ['Chrome']
    },
    test: {
      configFile: 'src/test/karma.conf.js',
      singleRun: true,
      browsers: ['PhantomJS']
    }
  };
};
