define([
  'angular',
  'lodash',
  'kbn',
  'moment',
  './queryCtrl',
],
function (angular, _, kbn) {
  'use strict';

  var module = angular.module('grafana.services');

  module.factory('OpenTSDBDatasource', function($q, $http, templateSrv) {

    function OpenTSDBDatasource(datasource) {
      this.type = 'opentsdb';
      this.editorSrc = 'app/features/opentsdb/partials/query.editor.html';
      this.url = datasource.url;
      this.name = datasource.name;
      this.supportMetrics = true;
      this.lastLookupType = '';
      this.lastLookupQuery = '';
      this.lastLookupResults = [];
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

    OpenTSDBDatasource.prototype.performSuggestQuery = function(query, type, target) {

      var that = this;
      var url = this.url;
      var options = {
        method: 'GET',
        url: this.url + '/api/suggest',
        params: {
          type: type,
          q: query,
          max: 99999

        }
      };
      return $http(options).then( function(result) {
        result.data.sort();

        if ((type == 'metrics' || !target.metric) && _.isEmpty(target.tags))
          return result.data;

          return that.performSearchLookup(type, target).then(function(lookupResults) {
            var output = intersect_safe(that.lastLookupResults, result.data);
  //        console.log("Lookup Results: " + JSON.stringify(that.lastLookupResults));
            console.log("Suggest Results: " + JSON.stringify(result.data));
            console.log("Merged Results: " + JSON.stringify(output));
            return output;
          }, function(error) {
            console.log("Could not performSuggestQuery...");
            return null;
          });
      });
    };


    OpenTSDBDatasource.prototype.performSearchLookup = function(type, target) {
      var that = this;
      var searchTags = [];
      if (!_.isEmpty(target.tags)) {
        _.each(_.pairs(target.tags), function(tag) {
          searchTags.push(''+ tag[0] + '=' + tag[1]);
        });
      }
      if (type == 'tagv')
        if (target.currentTagKey)
          searchTags.push(''+target.currentTagKey+'=*');
      else if (type == 'tagk')
        if (target.currentTagValue)
          searchTags.push('*='+target.currentTagValue);

      var search = '';
      if (type != 'metrics')
        search += target.metric;
      search += '{' + searchTags.join(',') + '}';

      if ((type == this.lastLookupType) && (this.lastLookupQuery == search))
        return this.lastLookupResults;
      this.lastLookupQuery = search;
      this.lastLookupType = type;

      var options = {
        method: 'GET',
        url: this.url + '/api/search/lookup',
        params: {
          m: search
        },
      };
      console.log(JSON.stringify(options));

      return $http(options).then(function(result) {
        // iterate through the results and find all the available/matching tags & values
        var resultSet = new Set();
        _.each(result.data.results, function(lookupResults) {
          if (type == 'metrics') {
            resultSet.add(lookupResults.metric);
          } else {
            _.each(_.pairs(lookupResults.tags), function(tag) {
              if (type == 'tagk') {
                if (!target.currentTagValue || (target.currentTagValue == tag[1]))
                  resultSet.add(tag[0]);
              } else {
                if (!target.currentTagKey || (target.currentTagKey == tag[0]))
                  resultSet.add(tag[1]);
              }
            })
          }
        });
        var resultsOut = [v for (v of resultSet)].sort();
        console.log("Lookup Results: " + JSON.stringify(resultsOut));
        that.lastLookupResults = resultsOut;
        return resultsOut;
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
        dps.push([v, k * 1000]);
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
        query.downsample = templateSrv.replace(target.downsampleInterval) + "-" + target.downsampleAggregator;
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

    function intersect_safe(a, b)
    {
      var ai = 0;
      var bi = 0;
      var result = [];

      while( ai < a.length && bi < b.length ){
         if      (a[ai] < b[bi] ){ ai++; }
         else if (a[ai] > b[bi] ){ bi++; }
         else /* they're equal */
         {
           result.push(a[ai]);
           ai++;
           bi++;
         }
      }

      return result;
    }

    return OpenTSDBDatasource;
  });

});
