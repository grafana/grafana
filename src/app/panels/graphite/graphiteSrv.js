define([
  'jquery',
  'rq',
  'config'
],
function ($, RQ, config) {
  'use strict';


  function build_graphite_options(options, raw) {
    raw = raw || false;
    var clean_options = [];
    //var internal_options = ['_t'];
    var graphite_options = ['target', 'targets', 'from', 'until', 'rawData', 'format', 'maxDataPoints'];
    var graphite_png_options = ['areaMode', 'width', 'height', 'template', 'margin', 'bgcolor',
                         'fgcolor', 'fontName', 'fontSize', 'fontBold', 'fontItalic',
                         'yMin', 'yMax', 'colorList', 'title', 'vtitle', 'lineMode',
                         'lineWith', 'hideLegend', 'hideAxes', 'hideGrid', 'minXstep',
                         'majorGridlineColor', 'minorGridLineColor', 'minorY',
                         'thickness', 'min', 'max', 'tz'];

    if(raw) {
      options['format'] = 'json';
    } else {
      // use random parameter to force image refresh
      options["_t"] = options["_t"] || Math.random();
    }

    $.each(options, function (key, value) {
      if(raw) {
        if ($.inArray(key, graphite_options) === -1) {
          return;
        }
      } else {
        if ($.inArray(key, graphite_options) === -1 && $.inArray(key, graphite_png_options) === -1) {
          return;
        }
      }
      if (key === "targets") {
        $.each(value, function (index, value) {
          if (raw) {
            // it's normally pointless to use alias() in raw mode, because we apply an alias (name) ourself
            // in the client rendering step.  we just need graphite to return the target.
            // but graphite sometimes alters the name of the target in the returned data
            // (https://github.com/graphite-project/graphite-web/issues/248)
            // so we need a good string identifier and set it using alias() (which graphite will honor)
            // so that we recognize the returned output. simplest is just to include the target spec again
            // though this duplicates a lot of info in the url.
            clean_options.push("target=" + encodeURIComponent(value.target));
          } else {
            clean_options.push("target=alias(color(" +encodeURIComponent(value.target + ",'" + value.color) +"'),'" + value.name +"')");
          }
        });
      } else if (value !== null) {
        clean_options.push(key + "=" + encodeURIComponent(value));
      }
    });
    return clean_options;
  }

  function loadGraphiteData(options)
  {
    return function (requestion) {
      var graphOptions = {
        from: $.plot.formatDate(options.range.from, '%H%:%M_%Y%m%d'),
        until: $.plot.formatDate(options.range.to, '%H%:%M_%Y%m%d'),
        targets: options.targets,
        maxDataPoints: options.maxDataPoints
      };

      var graphiteParameters = build_graphite_options(graphOptions, true);
      getGraphiteData(graphiteParameters)
        .done(function(data) {
          requestion(data);
        })
        .fail(function() {
          requestion(null, 'Error in ajax call to graphite');
        });
    };
  }

  function getGraphiteData(parameters) {
    return $.ajax({
      accepts: { text: 'application/json' },
      cache: false,
      dataType: 'json',
      url: config.graphiteUrl + '/render/',
      type: "POST",
      data: parameters.join('&')
    });
  }

  return {
    loadGraphiteData: loadGraphiteData
  };
});