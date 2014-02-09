define([
  'angular',
  'underscore',
  'moment'
], function (angular, _, moment) {
  'use strict';

  var module = angular.module('kibana.services');

  module.service('annotationsSrv', function(dashboard, graphiteSrv, $q, alertSrv) {

    this.init = function() {
      this.annotationList = [
        {
          type: 'graphite-target',
          enabled: false,
          target: 'metrics_data.mysite.dolph.counters.payment.cart_klarna_payment_completed.count',
          name: 'deploys',
        },
        {
          type: 'graphite-target',
          enabled: true,
          target: 'metrics_data.mysite.dolph.counters.payment.cart_paypal_payment_completed.count',
          name: 'restarts',
        }
      ];
    };

    this.getAnnotations = function(rangeUnparsed) {
      var graphiteAnnotations = _.where(this.annotationList, { type: 'graphite-target', enabled: true });
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

      return graphiteSrv.query(graphiteQuery)
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
                description: "<small><i class='icon-tag icon-flip-vertical'></i>test</small><br>"+
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
    };

    // Now init
    this.init();
  });

});