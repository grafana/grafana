define([
  'angular',
  'underscore',
  'jquery',
  'config',
  'kbn',
  'moment'
],
function (angular, _, $, config, kbn, moment) {
  'use strict';

  var module = angular.module('kibana.services');

  module.factory('GraphiteDatasource', function(dashboard, $q, $http) {

    function GraphiteDatasource(datasource) {
      this.type = 'graphite';
      this.basicAuth = datasource.basicAuth;
      this.url = datasource.url;
      this.editorSrc = 'app/partials/graphite/editor.html';
      this.name = datasource.name;
      this.render_method = datasource.render_method || 'POST';
    }

    GraphiteDatasource.prototype.query = function(filterSrv, options) {
      try {
        var graphOptions = {
          from: this.translateTime(options.range.from, 'round-down'),
          until: this.translateTime(options.range.to, 'round-up'),
          targets: options.targets,
          format: options.format,
          maxDataPoints: options.maxDataPoints,
        };

        var params = this.buildGraphiteParams(filterSrv, graphOptions);

        if (options.format === 'png') {
          return $q.when(this.url + '/render' + '?' + params.join('&'));
        }

        var httpOptions = { method: this.render_method, url: '/render' };

        if (httpOptions.method === 'GET') {
          httpOptions.url = httpOptions.url + '?' + params.join('&');
        }
        else {
          httpOptions.data = params.join('&');
          httpOptions.headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
        }

        return this.doGraphiteRequest(httpOptions);
      }
      catch(err) {
        return $q.reject(err);
      }
    };

    GraphiteDatasource.prototype.events = function(options) {
      try {
        var tags = '';
        if (options.tags) {
          tags = '&tags=' + options.tags;
        }

        return this.doGraphiteRequest({
          method: 'GET',
          url: '/events/get_data?from=' + this.translateTime(options.range.from) + '&until=' + this.translateTime(options.range.to) + tags,
        });
      }
      catch(err) {
        return $q.reject(err);
      }
    };

    GraphiteDatasource.prototype.translateTime = function(date, rounding) {
      if (_.isString(date)) {
        if (date === 'now') {
          return 'now';
        }
        else if (date.indexOf('now') >= 0) {
          date = date.substring(3);
          date = date.replace('m', 'min');
          date = date.replace('M', 'mon');
          return date;
        }

        date = kbn.parseDate(date);
      }

      date = moment.utc(date);

      if (rounding === 'round-up') {
        if (date.get('s')) {
          date.add('m', 1);
        }
      }
      else if (rounding === 'round-down') {
        // graphite' s from filter is exclusive
        // here we step back one minute in order
        // to guarantee that we get all the data that
        // exists for the specified range
        if (date.get('s')) {
          date.subtract('m', 1);
        }
      }

      return date.unix();
    };

    GraphiteDatasource.prototype.metricFindQuery = function(filterSrv, query) {
      var interpolated;
      try {
        interpolated = encodeURIComponent(filterSrv.applyTemplateToTarget(query));
      }
      catch(err) {
        return $q.reject(err);
      }

      return this.doGraphiteRequest({method: 'GET', url: '/metrics/find/?query=' + interpolated })
        .then(function(results) {
          return _.map(results.data, function(metric) {
            return {
              text: metric.text,
              expandable: metric.expandable ? true : false
            };
          });
        });
    };

    GraphiteDatasource.prototype.listDashboards = function(query) {
      return this.doGraphiteRequest({ method: 'GET',  url: '/dashboard/find/', params: {query: query || ''} })
        .then(function(results) {
          return results.data.dashboards;
        });
    };

    GraphiteDatasource.prototype.loadDashboard = function(dashName) {
      return this.doGraphiteRequest({method: 'GET', url: '/dashboard/load/' + encodeURIComponent(dashName) });
    };

    GraphiteDatasource.prototype.doGraphiteRequest = function(options) {
      if (this.basicAuth) {
        options.withCredentials = true;
        options.headers = options.headers || {};
        options.headers.Authorization = 'Basic ' + this.basicAuth;
      }

      options.url = this.url + options.url;

      return $http(options);
    };

    GraphiteDatasource.prototype.buildGraphiteParams = function(filterSrv, options) {
      var clean_options = [];
      var graphite_options = ['target', 'targets', 'from', 'until', 'rawData', 'format', 'maxDataPoints'];

      if (options.format !== 'png') {
        options['format'] = 'json';
      }

      _.each(options, function (value, key) {
        if ($.inArray(key, graphite_options) === -1) {
          return;
        }

        if (key === "targets") {
          _.each(value, function (value) {
            if (value.target && !value.hide) {
              var targetValue = filterSrv.applyTemplateToTarget(value.target);
              clean_options.push("target=" + encodeURIComponent(targetValue));
            }
          }, this);
        }
        else if (value !== null) {
          clean_options.push(key + "=" + encodeURIComponent(value));
        }
      }, this);
      return clean_options;
    };

    return GraphiteDatasource;

  });

});
