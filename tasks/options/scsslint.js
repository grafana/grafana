module.exports = function(config) {
  return {
    options: {
      bundleExec: true,
      config: 'public/sass/.scss-lint.yml',
      reporterOutput: null
    },
    core: {
      src: ['public/sass/**/*.scss', '!public/sass/base/_normalize.scss']
    }
  };
};
