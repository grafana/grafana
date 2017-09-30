module.exports = function(config) {

  return {
    src:{
      options: {},
      files: {
        "<%= srcDir %>/build/grafana.dark.css": "<%= srcDir %>/sass/grafana.dark.scss",
        "<%= srcDir %>/build/grafana.light.css": "<%= srcDir %>/sass/grafana.light.scss",
        "<%= srcDir %>/build/fonts.css": "<%= srcDir %>/sass/fonts.scss",
      }
    }
  };
};
