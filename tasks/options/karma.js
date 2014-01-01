module.exports = function(config) {
  return {
    unit: {
      configFile: 'src/test/karma.conf.js',
      singleRun: false,
      browsers: ['Chrome']
    }
  };
};