module.exports = function(config) {
  return {
    tgz: {
      options: {
        archive: '<%= destDir %>/<%= pkg.name %>-latest.tar.gz'
      },
      files : [
        {
          expand: true,
          cwd: '<%= tempDir %>',
          src: ['**/*'],
          dest: '<%= pkg.name %>/',
        },
        {
          expand: true,
          src: ['LICENSE.md', 'README.md', 'NOTICE.md'],
          dest: '<%= pkg.name %>/',
        }
      ]
    },
    tgz_release: {
      options: {
        archive: '<%= destDir %>/<%= pkg.name %>-<%= pkg.version %>.<%= arch %>.tar.gz'
      },
      files : [
        {
          expand: true,
          cwd: '<%= tempDir %>',
          src: ['**/*'],
          dest: '<%= pkg.name %>-<%= pkg.version %>/',
        },
        {
          expand: true,
          src: ['LICENSE.md', 'README.md', 'NOTICE.md'],
          dest: '<%= pkg.name %>-<%= pkg.version %>/',
        }
      ]
    }
  };
};
