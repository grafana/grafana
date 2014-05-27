define([
  'angular',
  'underscore',
  'kbn'
],
function (angular, _, kbn) {
  'use strict';

  var module = angular.module('kibana.services');

  module.factory('MonDatasource', function($q, $http) {

    function MonDatasource(datasource) {
      this.type = 'mon';
      this.editorSrc = 'app/partials/influxdb/editor.html';
      this.urls = datasource.urls;
      this.access_token = datasource.access_token;
      this.name = datasource.name;

      this.templateSettings = {
        interpolate : /\[\[([\s\S]+?)\]\]/g,
      };
    }

    MonDatasource.prototype.query = function(options) {

      var promises = _.map(options.targets, function(target) {
        var query;

        if (target.hide || !((target.series && target.column) || target.query)) {
          return [];
        }

        var timeFilter = getTimeFilter(options);

        if (target.rawQuery) {
            alert("Raw queries not supported")
            return [];
        }
        else {
          var query = {
                name: target.series,
                //dimensions: target.column,
                statistics: target.function,
                start_time: '2014-04-30T11:00:00Z'
          };
          return this.doMonRequest(query, target.alias).then(handleMonQueryResponse);
        }
        return [];
      }, this);

      return $q.all(promises).then(function(results) {
        return { data: _.flatten(results) };
      });

    };

    MonDatasource.prototype.listColumns = function(seriesName) {
      return this.doMonRequest('select * from ' + seriesName + ' limit 1').then(function(data) {
        if (!data) {
          return [];
        }

        return data[0].columns;
      });
    };

    MonDatasource.prototype.listSeries = function() {
      return this.doMonRequest('list series').then(function(data) {
        return _.map(data, function(series) {
          return series.name;
        });
      });
    };

    function retry(deferred, callback, delay) {
      return callback().then(undefined, function(reason) {
        if (reason.status !== 0) {
          deferred.reject(reason);
        }
        setTimeout(function() {
          return retry(deferred, callback, Math.min(delay * 2, 30000));
        }, delay);
      });
    }

    MonDatasource.prototype.doMonRequest = function(query, alias) {
      var _this = this;
      var deferred = $q.defer();

      retry(deferred, function() {
        var currentUrl = _this.urls.shift();
        _this.urls.push(currentUrl);

        var headers = {
            'X-Auth-Token': _this.access_token,
            'Content-Type': 'application/json'
        };

        //var params = query;

        var options = {
          method: 'GET',
          url:    currentUrl + '/metrics/statistics',
          params: query,
          headers: headers
        };

        return $http(options).success(function (data) {
          data.alias = alias;
          deferred.resolve(data);
        });
      }, 10);

      return deferred.promise;
    };

    function handleMonQueryResponse(data) {
      var output = [];

      _.each(data, function(series) {
        var timeCol = series.columns.indexOf('timestamp');

        _.each(series.columns, function(column, index) {
          if (column === "timestamp" || column === "id") {
            return;
          }

          var target = data.alias || series.name + "." + column;
          var datapoints = [];

          for(var i = 0; i < series.statistics.length; i++) {
            var myDate = new Date(series.statistics[i][timeCol]);
            var result = myDate.getTime() / 1000;
            datapoints[i] = [series.statistics[i][index], result];
          }

          output.push({ target:target, datapoints:datapoints });
        });
      });

      return output;
    }

    function getTimeFilter(options) {
      var from = getMonTime(options.range.from);
      var until = getMonTime(options.range.to);

      if (until === 'now()') {
        return 'time > now() - ' + from;
      }

      return 'time > ' + from + ' and time < ' + until;
    }

    function getMonTime(date) {
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


    return MonDatasource;

  });

});
