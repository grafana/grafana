module.exports = function(config) {

  return {
    src:{
      options: {},
      files: {
        "<%= genDir %>/css/grafana.dark.css": "<%= srcDir %>/sass/grafana.dark.scss",
        "<%= genDir %>/css/grafana.light.css": "<%= srcDir %>/sass/grafana.light.scss",
        "<%= genDir %>/css/fonts.css": "<%= srcDir %>/sass/fonts.scss",
      }
    }
  };
};
