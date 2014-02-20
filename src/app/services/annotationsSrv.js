define([
  'angular',
  'underscore',
  'moment'
], function (angular, _, moment) {
  'use strict';

  var module = angular.module('kibana.services');

  module.service('annotationsSrv', function(dashboard, datasourceSrv, $q, alertSrv, $rootScope) {
    var promiseCached;
    var annotationPanel;

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
    };

    this.getAnnotations = function(rangeUnparsed) {
      if (!annotationPanel.enable) {
        return $q.when(null);
      }

      if (promiseCached) {
        return promiseCached;
      }

      var graphiteMetrics = this.getGraphiteMetrics(rangeUnparsed);
      var graphiteEvents = this.getGraphiteEvents(rangeUnparsed);

      promiseCached = $q.all([graphiteMetrics, graphiteEvents])
        .then(function(allAnnotations) {
          var nonNull = _.filter(allAnnotations, function(value) { return value !== null; });
          return _.flatten(nonNull);
        });

      return promiseCached;
    };

    this.getGraphiteEvents = function(rangeUnparsed) {
      var annotations = _.where(annotationPanel.annotations, { type: 'graphite events', enable: true });
      var tags = _.pluck(annotations, 'tags');

      if (tags.length === 0) {
        return $q.when(null);
      }

      var eventsQuery = {
        range: rangeUnparsed,
        tags: tags.join(' '),
      };

      return datasourceSrv.default.events(eventsQuery)
        .then(function(results) {
          var list = [];
          _.each(results.data, function (event) {
            list.push(createAnnotation(annotations[0], event.when * 1000, event.what, event.tags, event.data));
          });
          return list;
        })
        .then(null, function() {
          alertSrv.set('Annotations','Could not fetch annotations','error');
        });
    };

    this.getGraphiteMetrics = function(rangeUnparsed) {
      var graphiteAnnotations = _.where(annotationPanel.annotations, { type: 'graphite metric', enable: true });
      var graphiteTargets = _.map(graphiteAnnotations, function(annotation) {
        return { target: annotation.target };
      });

      if (graphiteTargets.length === 0) {
        return $q.when(null);
      }

      var graphiteQuery = {
        range: rangeUnparsed,
        targets: graphiteTargets,
        format: 'json',
        maxDataPoints: 100
      };

      return datasourceSrv.default.query(graphiteQuery)
        .then(function(results) {
          return _.reduce(results.data, function(list, target) {
            _.each(target.datapoints, function (values) {
              if (values[0] === null) {
                return;
              }

              list.push(createAnnotation(graphiteAnnotations[0], values[1] * 1000, target.target));
            });

            return list;
          }, []);
        })
        .then(null, function() {
          alertSrv.set('Annotations','Could not fetch annotations','error');
        });
    };

    function createAnnotation(annotation, time, description, tags, data) {
      var tooltip = "<small><b>" + description + "</b><br/>";
      if (tags) {
        tooltip += (tags || '') + '<br/>';
      }
      tooltip += '<i>' + moment(time).format('YYYY-MM-DD HH:mm:ss') + '</i><br/>';
      if (data) {
        tooltip += data;
      }
      tooltip += "</small>";

      return {
        annotation: annotation,
        min: time,
        max: time,
        eventType: annotation.name,
        title: null,
        description: tooltip,
        score: 1
      };
    }

    // Now init
    this.init();
  });

});