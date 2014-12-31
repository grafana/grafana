module.exports = function(config) {
  return {
    html: [
      '<%= destDir %>/views/index.html',
      '<%= destDir %>/index.html',
    ],
    options: {
      assetsDirs: ['<%= destDir %>']
    }
  };
};
