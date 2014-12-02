define([
  'angular',
  'lodash',
  'kbn',
  'moment'
],
function (angular, _, kbn) {
  'use strict';

  var module = angular.module('grafana.services');

  module.factory('CustomDatasource', function($q) {

    // the datasource object passed to constructor
    // is the same defined in config.js
    function CustomDatasource(datasource) {
      this.name = datasource.name;
      this.supportMetrics = true;
      this.url = datasource.url;
    }

    CustomDatasource.prototype.query = function(options) {
      // get from & to in seconds
      var from = kbn.parseDate(options.range.from).getTime() / 1000;
      var to = kbn.parseDate(options.range.to).getTime() / 1000;

      var series = [];
      var stepInSeconds = (to - from) / options.maxDataPoints;

      for (var i = 0; i < 3; i++) {
        var walker = Math.random() * 100;
        var time = from;
        var timeSeries = {
          target: "Series " + i,
          datapoints: []
        };

        for (var j = 0; j < options.maxDataPoints; j++) {
          timeSeries.datapoints[j] = [walker, time];
          walker += Math.random() - 0.5;
          time += stepInSeconds;
        }

        series.push(timeSeries);
      }

      return $q.when({data: series });

    };

    return CustomDatasource;

  });

});
