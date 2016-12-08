module.exports = function(config) {

  return {
    src:{
      options: {
        paths: ["<%= srcDir %>/less"],
        yuicompress: true
      },
      files: {
        "<%= genDir %>/css/bootstrap.dark.min.css": "<%= srcDir %>/less/grafana.dark.less",
        "<%= genDir %>/css/bootstrap.light.min.css": "<%= srcDir %>/less/grafana.light.less",
        "<%= genDir %>/css/bootstrap-responsive.min.css": "<%= srcDir %>/less/grafana-responsive.less"
      }
    }
  };
};
