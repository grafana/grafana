define([
  'angular',
  'underscore',
  'kbn'
],
function (angular, _, kbn) {
  'use strict';

  var module = angular.module('kibana.services');

  module.factory('InfluxDatasource', function($q, $http) {

    function InfluxDatasource(datasource) {
      this.type = 'influxDB';
      this.editorSrc = 'app/partials/influxdb/editor.html';
      this.url = datasource.url;
      this.username = datasource.username;
      this.password = datasource.password;
      this.name = datasource.name;

      this.templateSettings = {
        interpolate : /\[\[([\s\S]+?)\]\]/g,
      };
    }

    InfluxDatasource.prototype.query = function(options) {

      var promises = _.map(options.targets, function(target) {
        if (!target.series || !target.column || target.hide) {
          return [];
        }

        // var template = "select [[func]]([[column]]) as [[column]]_[[func]] from [[series]] where [[timeFilter]] group by time([[interval]]) order asc";
        var template = "select [[func]]([[column]]) from [[series]] where [[condition]] [[timeFilter]] group by time([[interval]]) order asc";

        target.condition_joined = (target.condition !== undefined ? target.condition + ' AND ' : '');

        var templateData = {
          series: target.series,
          column: target.column,
          func: target.function,
          condition: target.condition_joined,
          timeFilter: getTimeFilter(options),
          interval: target.interval || options.interval
        };

        var query = _.template(template, templateData, this.templateSettings);

        return this.doInfluxRequest(query).then(handleInfluxQueryResponse);

      }, this);

      return $q.all(promises).then(function(results) {

        return { data: _.flatten(results) };
      });

    };

    InfluxDatasource.prototype.listColumns = function(seriesName) {
      return this.doInfluxRequest('select * from ' + seriesName + ' limit 1').then(function(results) {
        console.log('response!');
        if (!results.data) {
          return [];
        }

        return results.data[0].columns;
      });
    };

    InfluxDatasource.prototype.listSeries = function() {
      return this.doInfluxRequest('list series').then(function(results) {
        if (!results.data) {
          return [];
        }

        return _.map(results.data, function(series) {
          return series.name;
        });
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

      console.log(query);
      return $http(options);
    };

    function handleInfluxQueryResponse(results) {
      var output = [];

      var getKey = function (str) {
        var key1 = str.split(' where ');
        var key2 = key1[1].split(' AND ');
        return (key2[0] !== key1[1] ? '.' + key2[0] : '');
      }

      _.each(results.data, function(series) {
        var timeCol = series.columns.indexOf('time');

        _.each(series.columns, function(column, index) {
          if (column === "time" || column === "sequence_number") {
            return;
          }

          console.log("series:"+series.name + ": "+series.points.length + " points");

          var target = series.name + "." + column + getKey(results.config.params.q);
          var datapoints = [];

          for(var i = 0; i < series.points.length; i++) {
            var t = Math.floor(series.points[i][timeCol] / 1000);
            var v = series.points[i][index];
            datapoints[i] = [v,t];
          }

          output.push({ target:target, datapoints:datapoints });
        });
      });

      return output;
    }

    function getTimeFilter(options) {
      var from = getInfluxTime(options.range.from);
      var until = getInfluxTime(options.range.to);

      if (until === 'now()') {
        return 'time > now() - ' + from;
      }

      return 'time > ' + from + ' and time < ' + until;
    }

    function getInfluxTime(date) {
      if (_.isString(date)) {
        if (date === 'now') {
          return 'now()';
        }
        else if (date.indexOf('now') >= 0) {
          return date.substring(4);
        }

        date = kbn.parseDate(date);
      }

      return to_utc_epoch_seconds(date);
    }

    function to_utc_epoch_seconds(date) {
      return (date.getTime() / 1000).toFixed(0) + 's';
    }


    return InfluxDatasource;

  });

});
