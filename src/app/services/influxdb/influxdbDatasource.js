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

      this.templateSettings = {
        interpolate : /\[\[([\s\S]+?)\]\]/g,
      };
    }

    InfluxDatasource.prototype.query = function(options) {
      var target = options.targets[0];

      var template = "select [[func]]([[column]]) from [[series]] where [[timeFilter]] group by time([[interval]])";
      var templateData = {
        series: target.series,
        column: target.column,
        func: target.function,
        timeFilter: getTimeFilter(options),
        interval: options.interval
      };

      var query = _.template(template, templateData, this.templateSettings);
      console.log(query);

      var output = { data: [] };

      return this.doInfluxRequest(query).then(function(results) {

        _.each(results.data, function(series) {
          var timeCol = series.columns.indexOf('time');

          _.each(series.columns, function(column, index) {
            if (column === "time" || column === "sequence_number") {
              return;
            }

            console.log("series:"+series.name + ": "+series.points.length + " points");

            var target = series.name + "." + column;
            var datapoints = [];

            var i, y;
            for(i = series.points.length - 1, y = 0; i >= 0; i--, y++) {
              var t = Math.floor(series.points[i][timeCol] / 1000);
              var v = series.points[i][index];
              datapoints[y] = [v,t];
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

    function getTimeFilter(options) {
      var from = options.range.from;
      var until = options.range.to;

      if (_.isString(from)) {
        return 'time > now() - ' + from.substring(4);
      }
      else {
        from = to_utc_epoch_seconds(from);
      }

      if (until === 'now') {
        return 'time > ' + from;
      }
      else {
        until = to_utc_epoch_seconds(until);
        return 'time > ' + from + ' and time < ' + until;
      }
    }

    function to_utc_epoch_seconds(date) {
      return (date.getTime() / 1000).toFixed(0) + 's';
    }


    return InfluxDatasource;

  });

});
