module.exports = function(config) {

  return {
    options: {
      map: true, // inline sourcemaps

      // or
      map: {
        inline: false, // save all sourcemaps as separate files...
        annotation: '<%= genDir %>/css' // ...to the specified directory
      },

      processors: [
        require('autoprefixer')({browsers: 'last 3 versions'}), // add vendor prefixes
      ]
    },
    dist: {
      src: '<%= genDir %>/css/*.css'
    }
  }
};
