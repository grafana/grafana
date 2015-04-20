module.exports = function(config) {

  var task = {
    release: {
      options: {
        archive: '<%= destDir %>/<%= pkg.name %>-<%= pkg.version %>.<%= platform %>-<%= arch %>.tar.gz'
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
    }
  };

  if (config.platform === 'windows') {
    task.release.options.archive = '<%= destDir %>/<%= pkg.name %>-<%= pkg.version %>.<%= platform %>-<%= arch %>.zip';
  }

  return task;
};
