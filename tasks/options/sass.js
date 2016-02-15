module.exports = function(config) {

  return {
    src:{
      options: {},
      files: {
        "<%= genDir %>/css/grafana.dark.min.css": "<%= srcDir %>/less/grafana.dark.scss",
        "<%= genDir %>/css/grafana.light.min.css": "<%= srcDir %>/less/grafana.light.scss",
      }
    }
  };
};
