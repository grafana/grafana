module.exports = function(config) {
  return {
    zip: {
      options: {
        archive: '<%= tempDir %>/<%= pkg.name %>-latest.zip'
      },
      files : [
        {
          expand: true,
          cwd: '<%= destDir %>',
          src: ['**/*'],
        },
        {
          expand: true,
          src: ['LICENSE.md', 'README.md', 'NOTICE.md'],
        }
      ]
    },
    tgz: {
      options: {
        archive: '<%= tempDir %>/<%= pkg.name %>-latest.tar.gz'
      },
      files : [
        {
          expand: true,
          cwd: '<%= destDir %>',
          src: ['**/*'],
        },
        {
          expand: true,
          src: ['LICENSE.md', 'README.md', 'NOTICE.md'],
        }
      ]
    },
    zip_release: {
      options: {
        archive: '<%= tempDir %>/<%= pkg.name %>-<%= pkg.version %>.zip'
      },
      files : [
        {
          expand: true,
          cwd: '<%= destDir %>',
          src: ['**/*'],
        },
        {
          expand: true,
          src: ['LICENSE.md', 'README.md', 'NOTICE.md'],
        }
      ]
    },
    tgz_release: {
      options: {
        archive: '<%= tempDir %>/<%= pkg.name %>-<%= pkg.version %>.tar.gz'
      },
      files : [
        {
          expand: true,
          cwd: '<%= destDir %>',
          src: ['**/*'],
        },
        {
          expand: true,
          src: ['LICENSE.md', 'README.md', 'NOTICE.md'],
        }
      ]
    }
  };
};