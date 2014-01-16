module.exports = function(config) {
  return {
    dev: {
      options: {
        port: 5602,
        base: config.baseDir,
        keepalive: true
      }
    },
  }
};