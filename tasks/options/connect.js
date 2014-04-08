module.exports = function(config) {
  return {
    dev: {
      options: {
        port: 5601,
        hostname: '*',
        base: config.srcDir,
        keepalive: true
      }
    },
  }
};