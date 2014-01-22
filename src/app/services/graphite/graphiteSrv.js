define([
  'angular',
  'underscore',
  'jquery',
  'config'
],
function (angular, _, $, config) {
  'use strict';

  var module = angular.module('kibana.services');

  module.service('graphiteSrv', function($http, $q, filterSrv) {

    this.query = function(options) {
      try {
        var graphOptions = {
          from: this.translateTime(options.range.from),
          until: this.translateTime(options.range.to),
          targets: options.targets,
          maxDataPoints: options.maxDataPoints
        };

        var params = buildGraphitePostParams(graphOptions);

        return $http({
          method: 'POST',
          url: config.graphiteUrl + '/render/',
          data: params.join('&'),
          headers: {'Content-Type': 'application/x-www-form-urlencoded'}
        });
      }
      catch(err) {
        return $q.reject(err);
      }
    };

    this.translateTime = function(date) {
      if (_.isDate(date)) {
        return $.plot.formatDate(date, '%H%:%M_%Y%m%d');
      }

      if (date === 'now') {
        return 'now';
      }

      date = date.substring(3);
      date = date.replace('m', 'min');
      date = date.replace('M', 'mon');

      return date;
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

    this.metricFindQuery = function(query) {
      var interpolated;
      try {
        interpolated = filterSrv.applyFilterToTarget(query);
      }
      catch(err) {
        return $q.reject(err);
      }

      var url = config.graphiteUrl + '/metrics/find/?query=' + interpolated;
      return $http.get(url)
        .then(function(results) {
          return _.map(results.data, function(metric) {
            return {
              text: metric.text,
              expandable: metric.expandable ? true : false
            };
          });
        });
    };

    this.listDashboards = function(query) {
      var url = config.graphiteUrl + '/dashboard/find/';
      return $http.get(url, {params: {query: query || ''}})
        .then(function(results) {
          return results.data.dashboards;
        });
    };

    this.loadDashboard = function(dashName) {
      var url = config.graphiteUrl + '/dashboard/load/' + encodeURIComponent(dashName);
      return $http.get(url);
    };

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
              var targetValue = filterSrv.applyFilterToTarget(value.target);
              clean_options.push("target=" + encodeURIComponent(targetValue));
            }
          });
        }
        else if (value !== null) {
          clean_options.push(key + "=" + encodeURIComponent(value));
        }
      });
      return clean_options;
    }

  });

});