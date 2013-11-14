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
          dest: '<%= pkg.name %>-latest'
        },
        {
          expand: true,
          src: ['LICENSE.md', 'README.md'],
          dest: '<%= pkg.name %>-latest'
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
          dest: '<%= pkg.name %>-latest'
        },
        {
          expand: true,
          src: ['LICENSE.md', 'README.md'],
          dest: '<%= pkg.name %>-latest'
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
          dest: '<%= pkg.name %>-<%= pkg.version %>'
        },
        {
          expand: true,
          src: ['LICENSE.md', 'README.md'],
          dest: '<%= pkg.name %>-<%= pkg.version %>'
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
          dest: '<%= pkg.name %>-<%= pkg.version %>'
        },
        {
          expand: true,
          src: ['LICENSE.md', 'README.md'],
          dest: '<%= pkg.name %>-<%= pkg.version %>'
        }
      ]
    }
  };
};