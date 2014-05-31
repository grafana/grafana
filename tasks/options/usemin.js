module.exports = function(config) {
  return {
    html: '<%= destDir %>/index.html',
    options: {
      assetsDirs: ['<%= destDir %>/css/']
    }
  };
};
