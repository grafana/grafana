define([
    'angular',
    'lodash'
  ],
  function (angular, _) {
    'use strict';

    var module = angular.module('grafana.services');

    module.factory('AtlasDatasource', function($q, $http) {

      function AtlasDatasource(datasource) {
        this.type = 'atlas';
        this.url = datasource.url;
        this.supportMetrics = true;
      }

      AtlasDatasource.prototype.query = function(options) {
        var deferred = $q.defer();

        // Atlas can take multiple concatenated stack queries
        var fullQuery = _.pluck(options.targets, 'query').join(',');

        var params = {
          q: fullQuery,
          step: options.interval,
          s: options.range.from,
          e: options.range.to,
          format: 'json'
        };

        var httpOptions = {
          method: 'GET',
          url:    this.url + '/api/v1/graph',
          params: params,
          inspect: { type: 'atlas' }
        };

        $http(httpOptions).success(function (data) {
          deferred.resolve({
            data: makeTimeSeries(data)
          });
        });

        return deferred.promise;
      };

      function makeTimeSeries (result) {
        return _.map(result.legend, function (legend, index) {
          var series = {target: legend, datapoints: []};
          var values = _.pluck(result.values, index);

          for (var i = 0; i < values.length; i++) {
            var value = values[i];
            var timestamp = result.start + (i * result.step);
            series.datapoints.push([value, timestamp]);
          }

          return series;
        });
      }

      return AtlasDatasource;
    });

  });
