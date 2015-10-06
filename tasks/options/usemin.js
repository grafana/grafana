module.exports = function() {
  'use strict';

  return {
    html: [
      '<%= genDir %>/views/index.html',
      '<%= genDir %>/views/500.html',
    ],
    options: {
      assetsDirs: ['<%= genDir %>'],
      patterns: {
        css: [
          [/(\.css)/, 'Replacing reference to image.png']
        ]
      }
      // blockReplacements: {
      //   css: function (block) {
      //     console.log('aaaaaaaaaaaaa', block);
      //     return '<link rel="stylesheet" href="aaaa' + block.dest + '">';
      //   }
      // }
      // css: [
      //   [/(grafana\.light\.min\.css)/, 'Replacing reference to light css', function(asd) {
      //     console.log("Match", asd);
      //     return 'css/grafana.light.min.css';
      //   }]
      // ]
    }
  };
};
