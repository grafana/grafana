define([
  'angular',
  'lodash',
  'kbn',
  'moment'
],
function (angular, _, kbn) {
  'use strict';

  var module = angular.module('grafana.services');

  module.factory('OpenTSDBDatasource', function($q, $http, templateSrv) {

    function OpenTSDBDatasource(datasource) {
      this.type = 'opentsdb';
      this.editorSrc = 'app/partials/opentsdb/editor.html';
      this.url = datasource.url;
      this.name = datasource.name;
      this.supportMetrics = true;
    }

    // Called once per panel (graph)
    OpenTSDBDatasource.prototype.query = function(options) {
      var start = convertToTSDBTime(options.range.from);
      var end = convertToTSDBTime(options.range.to);
      var queries = _.compact(_.map(options.targets, convertTargetToQuery));

      // No valid targets, return the empty result to save a round trip.
      if (_.isEmpty(queries)) {
        var d = $q.defer();
        d.resolve({ data: [] });
        return d.promise;
      }

      var groupByTags = {};
      _.each(queries, function(query) {
        _.each(query.tags, function(val, key) {
          groupByTags[key] = true;
        });
      });

      return this.performTimeSeriesQuery(queries, start, end)
        .then(_.bind(function(response) {
          var result = _.map(response.data, _.bind(function(metricData, index) {
            return transformMetricData(metricData, groupByTags, this.targets[index]);
          }, this));
          return { data: result };
        }, options));
    };

    OpenTSDBDatasource.prototype.performTimeSeriesQuery = function(queries, start, end) {
      var reqBody = {
        start: start,
        queries: queries
      };

      // Relative queries (e.g. last hour) don't include an end time
      if (end) {
        reqBody.end = end;
      }

      var options = {
        method: 'POST',
        url: this.url + '/api/query',
        data: reqBody
      };

      return $http(options);
    };

    OpenTSDBDatasource.prototype.performSuggestQuery = function(query, type) {
      var options = {
        method: 'GET',
        url: this.url + '/api/suggest',
        params: {
          type: type,
          q: query
        }
      };
      return $http(options).then(function(result) {
        return result.data;
      });
    };

    function transformMetricData(md, groupByTags, options) {
      var dps = [],
          tagData = [],
          metricLabel = null;

      if (!_.isEmpty(md.tags)) {
        _.each(_.pairs(md.tags), function(tag) {
          if (_.has(groupByTags, tag[0])) {
            tagData.push(tag[0] + "=" + tag[1]);
          }
        });
      }

      metricLabel = createMetricLabel(md.metric, tagData, options);

      // TSDB returns datapoints has a hash of ts => value.
      // Can't use _.pairs(invert()) because it stringifies keys/values
      _.each(md.dps, function (v, k) {
        dps.push([v, k]);
      });

      return { target: metricLabel, datapoints: dps };
    }

    function createMetricLabel(metric, tagData, options) {
      if (!_.isUndefined(options) && options.alias) {
        return options.alias;
      }

      if (!_.isEmpty(tagData)) {
        metric += "{" + tagData.join(", ") + "}";
      }

      return metric;
    }

    function convertTargetToQuery(target) {
      if (!target.metric) {
        return null;
      }

      var query = {
        metric: templateSrv.replace(target.metric),
        aggregator: "avg"
      };

      if (target.aggregator) {
        query.aggregator = templateSrv.replace(target.aggregator);
      }

      if (target.shouldComputeRate) {
        query.rate = true;
        query.rateOptions = {
          counter: !!target.isCounter
        };

        if (target.counterMax && target.counterMax.length) {
          query.rateOptions.counterMax = parseInt(target.counterMax);
        }

        if (target.counterResetValue && target.counterResetValue.length) {
          query.rateOptions.resetValue = parseInt(target.counterResetValue);
        }
      }

      if (target.shouldDownsample) {
        query.downsample = target.downsampleInterval + "-" + target.downsampleAggregator;
      }

      query.tags = angular.copy(target.tags);
      if(query.tags){
        for(var key in query.tags){
          query.tags[key] = templateSrv.replace(query.tags[key]);
        }
      }

      return query;
    }

    function convertToTSDBTime(date) {
      if (date === 'now') {
        return null;
      }

      date = kbn.parseDate(date);

      return date.getTime();
    }

    return OpenTSDBDatasource;
  });

});
