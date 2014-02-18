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

      promiseCached = datasourceSrv.default.query(graphiteQuery)
        .then(function(results) {
          return _.reduce(results.data, function(list, target) {
            _.each(target.datapoints, function (values) {
              if (values[0] === null) {
                return;
              }


              list.push({
                min: values[1] * 1000,
                max: values[1] * 1000,
                eventType: "annotation",
                title: null,
                description: "<small>" + target.target + "</small><br>"+
                  moment(values[1] * 1000).format('YYYY-MM-DD HH:mm:ss'),
                score: 1
              });
            });

            return list;
          }, []);
        })
        .then(null, function() {
          alertSrv.set('Annotations','Could not fetch annotations','error');
        });

      return promiseCached;
    };

    // Now init
    this.init();
  });

});