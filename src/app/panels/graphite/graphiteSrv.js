define([
  'jquery',
  'rq',
  'underscore',
  'config'
],
function ($, RQ, _, config) {
  'use strict';


  function build_graphite_options(options) {
    var clean_options = [];
    var graphite_options = ['target', 'targets', 'from', 'until', 'rawData', 'format', 'maxDataPoints'];

    options['format'] = 'json';

    $.each(options, function (key, value) {
      if ($.inArray(key, graphite_options) === -1) {
        return;
      }

      if (key === "targets") {
        $.each(value, function (index, value) {
          if (!value.hide) {
            clean_options.push("target=" + encodeURIComponent(value.target));
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

      var graphiteParameters = build_graphite_options(graphOptions);
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

  function match(targets, graphiteTargetStr) {
    var found = targets[0];

    for (var i = 0; i < targets.length; i++) {
      if (targets[i].target === graphiteTargetStr) {
        found = targets[i];
        break;
      }
      if(targets[i].target.match("'" + graphiteTargetStr + "'")) {
        found = targets[i];
      }
    }

    return found;
  }

  return {
    loadGraphiteData: loadGraphiteData,
    match: match
  };
});