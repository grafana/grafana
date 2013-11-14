module.exports = function(config) {
  return {
    dist: {
      bucket: 'download.elasticsearch.org',
      access: 'private',
      // debug: true, // uncommment to prevent actual upload
      upload: [
        {
          src: '<%= tempDir %>/<%= pkg.name %>-latest.zip',
          dest: 'kibana/kibana/<%= pkg.name %>-latest.zip',
        },
        {
          src: '<%= tempDir %>/<%= pkg.name %>-latest.tar.gz',
          dest: 'kibana/kibana/<%= pkg.name %>-latest.tar.gz',
        }
      ]
    },
    release: {
      bucket: 'download.elasticsearch.org',
      access: 'private',
      // debug: true, // uncommment to prevent actual upload
      upload: [
        {
          src: '<%= tempDir %>/<%= pkg.name %>-<%= pkg.version %>.zip',
          dest: 'kibana/kibana/<%= pkg.name %>-<%= pkg.version %>.zip',
        },
        {
          src: '<%= tempDir %>/<%= pkg.name %>-<%= pkg.version %>.tar.gz',
          dest: 'kibana/kibana/<%= pkg.name %>-<%= pkg.version %>.tar.gz',
        }
      ]
    }
  };
};