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
    dist: {
      options: {
        port: 5605,
        hostname: '*',
        base: config.destDir,
        keepalive: true
      }
    },
  }
};
