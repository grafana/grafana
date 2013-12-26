define([
  'angular',
  'underscore',
  'jquery',
  'config'
],
function (angular, _, $, config) {
  'use strict';

  var module = angular.module('kibana.services');

  module.service('graphiteSrv', function($http) {

    this.query = function(options) {
      var graphOptions = {
        from: $.plot.formatDate(options.range.from, '%H%:%M_%Y%m%d'),
        until: $.plot.formatDate(options.range.to, '%H%:%M_%Y%m%d'),
        targets: options.targets,
        maxDataPoints: options.maxDataPoints
      };

      var params = buildGraphitePostParams(graphOptions);

      var url = config.graphiteUrl + '/render/';
      return $http({
        method: 'POST',
        url: url,
        data: params.join('&'),
        headers: {'Content-Type': 'application/x-www-form-urlencoded'}
      });
    };

    this.match = function(targets, graphiteTargetStr) {
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
    };

    /*function getGraphiteData(parameters) {
      return $.ajax({
        accepts: { text: 'application/json' },
        cache: false,
        dataType: 'json',
        url: config.graphiteUrl + '/render/',
        type: "POST",
        data: parameters.join('&')
      });
    }
*/
    function buildGraphitePostParams(options) {
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

  });

});