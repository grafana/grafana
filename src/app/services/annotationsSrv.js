define([
  'angular',
  'underscore',
  'moment',
  'kbn'
], function (angular, _, moment, kbn) {
  'use strict';

  var module = angular.module('kibana.services');

  module.service('annotationsSrv', function(dashboard, datasourceSrv, $q, alertSrv, $rootScope) {
    var promiseCached;
    var annotationPanel;
    var list = [];

    this.init = function() {
      $rootScope.$on('refresh', this.clearCache);
      $rootScope.$on('dashboard-loaded', this.dashboardLoaded);

      this.dashboardLoaded();
    };

    this.dashboardLoaded = function () {
      annotationPanel = _.findWhere(dashboard.current.pulldowns, { type: 'annotations' });
    };

    this.clearCache = function() {
      promiseCached = null;
      list = [];
    };

    this.getAnnotations = function(filterSrv, rangeUnparsed) {
      if (!annotationPanel.enable) {
        return $q.when(null);
      }

      if (promiseCached) {
        return promiseCached;
      }

      var graphiteMetrics = this.getGraphiteMetrics(filterSrv, rangeUnparsed);
      var graphiteEvents = this.getGraphiteEvents(rangeUnparsed);
      var influxdbEvents = this.getInfluxdbEvents(rangeUnparsed);

      promiseCached = $q.all(graphiteMetrics.concat(graphiteEvents).concat(influxdbEvents))
        .then(function() {
          return list;
        });

      return promiseCached;
    };

    this.getInfluxdbEvents = function(rangeUnparsed) {
      var annotations = this.getAnnotationsByType('influxdb events');
      if (annotations.length === 0) {
        return [];
      }

      var parseDate = function (date) {
        var time = kbn.parseDate(date)
        return (time.getTime() / 1000).toFixed(0) + 's';
      };

      var timerange = ' time > ' + parseDate(rangeUnparsed.from) + ' and time < ' + parseDate(rangeUnparsed.to);

      var promises = _.map(annotations, function (annotation) {
        var where_pos = angular.lowercase(annotation.query).indexOf(' where ');
        var group_pos = angular.lowercase(annotation.query).indexOf(' group ');
        var query = annotation.query;

        if (where_pos > 0) {
          query = [annotation.query.slice(0, where_pos + 7), timerange, ' and ', annotation.query.slice(where_pos + 7)].join('');
        }
        else if (group_pos > 0) {
          query = [annotation.query.slice(0, group_pos), ' where ', timerange, annotation.query.slice(group_pos)].join('');
        }

        return datasourceSrv.default
          .doInfluxRequest(query)
          .then(function (results) {
            _.each(results, function (series) {
              _.each(series.points, function (point) {
                addAnnotation({
                  annotation: annotation,
                  time: point[0],
                  description: annotation.message
                });
              });
            });
          })
          .then(null, errorHandler);
      });

      return promises;
    };

    this.getGraphiteEvents = function(rangeUnparsed) {
      var annotations = this.getAnnotationsByType('graphite events');
      if (annotations.length === 0) {
        return [];
      }

      var promises = _.map(annotations, function(annotation) {

        return datasourceSrv.default.events({ range: rangeUnparsed, tags: annotation.tags })
          .then(function(results) {
            _.each(results.data, function (event) {
              addAnnotation({
                annotation: annotation,
                time: event.when * 1000,
                description: event.what,
                tags: event.tags,
                data: event.data
              });
            });
          })
          .then(null, errorHandler);
      });

      return promises;
    };

    this.getAnnotationsByType = function(type) {
      return _.where(annotationPanel.annotations, {
        type: type,
        enable: true
      });
    };

    this.getGraphiteMetrics = function(filterSrv, rangeUnparsed) {
      var annotations = this.getAnnotationsByType('graphite metric');
      if (annotations.length === 0) {
        return [];
      }

      var promises = _.map(annotations, function(annotation) {
        var graphiteQuery = {
          range: rangeUnparsed,
          targets: [{ target: annotation.target }],
          format: 'json',
          maxDataPoints: 100
        };

        var receiveFunc = _.partial(receiveGraphiteMetrics, annotation);

        return datasourceSrv.default.query(filterSrv, graphiteQuery)
          .then(receiveFunc)
          .then(null, errorHandler);
      });

      return promises;
    };

    function errorHandler(err) {
      console.log('Annotation error: ', err);
      alertSrv.set('Annotations','Could not fetch annotations','error');
    }

    function receiveGraphiteMetrics(annotation, results) {
      for (var i = 0; i < results.data.length; i++) {
        var target = results.data[i];

        for (var y = 0; y < target.datapoints.length; y++) {
          var datapoint = target.datapoints[y];

          if (datapoint[0]) {
            addAnnotation({
              annotation: annotation,
              time: datapoint[1] * 1000,
              description: target.target
            });
          }
        }
      }
    }

    function addAnnotation(options) {
      var tooltip = "<small><b>" + options.description + "</b><br/>";
      if (options.tags) {
        tooltip += (options.tags || '') + '<br/>';
      }
      tooltip += '<i>' + moment(options.time).format('YYYY-MM-DD HH:mm:ss') + '</i><br/>';
      if (options.data) {
        tooltip += options.data.replace(/\n/g, '<br/>');
      }
      tooltip += "</small>";

      list.push({
        annotation: options.annotation,
        min: options.time,
        max: options.time,
        eventType: options.annotation.name,
        title: null,
        description: tooltip,
        score: 1
      });
    }

    // Now init
    this.init();
  });

});
