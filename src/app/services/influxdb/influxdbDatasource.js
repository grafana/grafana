define([
  'angular',
  'underscore',
],
function (angular, _) {
  'use strict';

  var module = angular.module('kibana.services');

  module.factory('InfluxDatasource', function($q, $http) {

    function InfluxDatasource(datasource) {
      this.type = 'influxDB';
      this.editorSrc = 'app/partials/influxDB/editor.html';
      this.url = datasource.url;
      this.username = datasource.username;
      this.password = datasource.password;
    }

    InfluxDatasource.prototype.query = function() {

      var q = "select value from request_count where time > now() - 1h group by time(1m)";

      var output = { data: [] };

      return this.doInfluxRequest(q).then(function(results) {

        _.each(results.data, function(series) {
          var timeCol = series.columns.indexOf('time');

          _.each(series.columns, function(column, index) {
            if (column === "time" || column === "sequence_number") {
              return;
            }

            console.log("series:"+series.name + ": "+series.points.length + " points");

            var target = series.name + "." + column;
            var datapoints = [];

            for(var i=0; i < series.points.length; i++) {
              var t = Math.floor(series.points[i][timeCol] / 1000);
              var v = series.points[i][index];
              datapoints[i] = [v,t];
            }

            output.data.push({ target:target, datapoints:datapoints });
          });
        });

        return output;
      });

    };

    InfluxDatasource.prototype.doInfluxRequest = function(query) {
      var params = {
        u: this.username,
        p: this.password,
        q: query
      };

      var options = {
        method: 'GET',
        url:    this.url + '/series',
        params: params,
      };

      return $http(options);
    };


    return InfluxDatasource;

  });

});
