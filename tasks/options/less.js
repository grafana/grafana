module.exports = function(config) {
  return {
    // this is the only task, other than copy, that runs on the src directory, since we don't really need
    // the less files in the dist. Everything else runs from on temp, and require copys everything
    // from temp -> dist
    dist:{
      expand: true,
      cwd:'<%= srcDir %>/vendor/bootstrap/less/',
      src: ['bootstrap.dark.less', 'bootstrap.light.less'],
      dest: '<%= tempDir %>/css/',
    },
    // Compile in place when not building
    src:{
      options: {
        paths: ["<%= srcDir %>/vendor/bootstrap/less"],
        yuicompress:true
      },
      files: {
        "<%= srcDir %>/css/bootstrap.dark.min.css": "<%= srcDir %>/vendor/bootstrap/less/bootstrap.dark.less",
        "<%= srcDir %>/css/bootstrap.light.min.css": "<%= srcDir %>/vendor/bootstrap/less/bootstrap.light.less"
      }
    }
  };
};