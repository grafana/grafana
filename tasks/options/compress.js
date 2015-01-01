module.exports = function(config) {
  return {
    zip: {
      options: {
        archive: '<%= destDir %>/<%= pkg.name %>-latest.zip'
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
          dest: '<%= pkg.name %>/',
          src: ['LICENSE.md', 'README.md', 'NOTICE.md'],
        }
      ]
    },
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
    zip_release: {
      options: {
        archive: '<%= destDir %>/<%= pkg.name %>-<%= pkg.version %>.zip'
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
    },
    tgz_release: {
      options: {
        archive: '<%= destDir %>/<%= pkg.name %>-<%= pkg.version %>.tar.gz'
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
