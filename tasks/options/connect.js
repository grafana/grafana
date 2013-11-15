module.exports = function(config) {
  return {
    dev: {
      options: {
        port: 5601,
        base: config.srcDir,
        keepalive: true
      }
    },
  }
};