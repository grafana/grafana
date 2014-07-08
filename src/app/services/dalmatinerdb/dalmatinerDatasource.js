define([
  'angular',
  'underscore',
  'kbn',
  './dalmatinerSeries'
], function (angular, _, kbn, DalmatinerSeries) {
  'use strict';

  var module = angular.module('kibana.services');

  module.factory('DalmatinerDatasource', function($q, $http) {

    function DalmatinerDatasource(datasource) {
      this.type = 'dalmatinerdb';
      this.editorSrc = 'app/partials/dalmatinerdb/editor.html';
      this.urls = datasource.urls || [datasource.url];
      this.name = datasource.name;
      this.templateSettings = {
        interpolate : /\[\[([\s\S]+?)\]\]/g,
      };
    }

    DalmatinerDatasource.prototype.query = function(filterSrv, options) {
      var promises = _.map(options.targets, function(target) {
        var query = "SELECT ";
        var alias = '';
        var timeFilter = getTimeFilter(options);
        var src = target.metric + " BUCKET " + target.bucket;

        if (target.mget && target.mget !== 'none') {
          src = target.mget + "(" + src + ")";
        }

        target.aggrs.forEach(function(aggr) {
          src = aggr.name + "(" + src;
          if (aggr.val) {
            src = src + ", " + aggr.val;
          }
          src = src + ")";
        });

        query = query + src;
        if (target.alias) {
          query = query + " AS " + target.alias;
        }
        if (query !== "SELECT ") {
          query = query + timeFilter;
          query = filterSrv.applyTemplateToTarget(query);
          target.query = query;

          var handleResponse = _.partial(handleDalmatinerQueryResponse);
          return this.doDalmatinerRequest(query, alias).then(handleResponse);
        }
      }, this);
      return $q.all(promises).then(function(results) {
        return { data: _.flatten(results) };
      });

    };

    DalmatinerDatasource.prototype.listBuckets = function() {
      var _this = this;
      var deferred = $q.defer();
      retry(deferred, function() {
        var currentUrl = _this.urls.shift();
        _this.urls.push(currentUrl);
        var options = {
          method: 'GET',
          url:    currentUrl + '/buckets'
        };

        return $http(options).success(function (data) {
          deferred.resolve(data);
        });
      }, 10);

      return deferred.promise.then(function(data) {
        return data;
      });
    };

    DalmatinerDatasource.prototype.listMetrics = function(bucket) {
      var _this = this;
      var deferred = $q.defer();
      retry(deferred, function() {
        var currentUrl = _this.urls.shift();
        _this.urls.push(currentUrl);
        var options = {
          method: 'GET',
          url:    currentUrl + '/buckets/' + bucket
        };

        return $http(options).success(function (data) {
          deferred.resolve(data);
        });
      }, 10);

      return deferred.promise.then(function(data) {
        return data;
      });
    };

    DalmatinerDatasource.prototype.metricFindQuery = function (filterSrv, query) {
      var interpolated;
      try {
        interpolated = filterSrv.applyTemplateToTarget(query);
      }
      catch (err) {
        return $q.reject(err);
      }
      var parts = interpolated.split(/\//);
      var bucket = parts[0];
      var metric = parts[1] || "";
      return this.listMetrics(bucket).then(function(metrics) {
        metrics = metrics.filter(function(e) {
          return e.match(metric);
        });
        return _.map(metrics, function(e) {
          return {
            text: e.match(metric)[1],
            expandable: false
          };
        });
      });
    };

    function retry(deferred, callback, delay) {
      return callback().then(undefined, function(reason) {
        if (reason.status !== 0 || reason.status >= 300) {
          deferred.reject(reason);
        }
        else {
          setTimeout(function() {
            return retry(deferred, callback, Math.min(delay * 2, 30000));
          }, delay);
        }
      });
    }

    DalmatinerDatasource.prototype.doDalmatinerRequest = function(query) {
      var _this = this;
      var deferred = $q.defer();

      retry(deferred, function() {
        var currentUrl = _this.urls.shift();
        _this.urls.push(currentUrl);

        var params = {
          q: query
        };

        var options = {
          method: 'GET',
          url:    currentUrl + '/',
          params: params,
        };

        return $http(options).success(function (data) {
          deferred.resolve(data);
        });
      }, 10);

      return deferred.promise;
    };

    function handleDalmatinerQueryResponse(seriesList) {
      var dalmatinerSeries = new DalmatinerSeries(seriesList.d);

      return dalmatinerSeries.getTimeSeries();
    }

    function getTimeFilter(options) {
      var from = getDalmatinerTime(options.range.from);
      var until = getDalmatinerTime(options.range.to);
      console.log(options.range)

      if (_.isString(from) && until == "now") {
        return " LAST " + from;
      }
      if (_.isString(from)) {
        from = from + "AGO"
      }
      if (until == "now"){
        return ' BETWEEN ' + from + ' AND ' + until;
      }
      if (_.isString(until)) {
        from = from + "AGO"
      }
      return ' BETWEEN ' + from + ' AND ' + until;

    }

    function getDalmatinerTime(date) {
      if (_.isString(date)) {
        if (date === 'now') {
          return date;
        }
        if (date.indexOf('now') >= 0) {
          return date.substring(4);
        }

        date = kbn.parseDate(date);
      }

      return to_utc_epoch_seconds(date);
    }

    function to_utc_epoch_seconds(date) {
      return parseInt((date.getTime() / 1000).toFixed(0));
    }

    return DalmatinerDatasource;

  });

});
