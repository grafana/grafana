define([
  'angular',
  'lodash',
  'moment'
], function (angular, _, moment) {
  'use strict';

  var module = angular.module('grafana.services');

  module.service('annotationsSrv', function(datasourceSrv, $q, alertSrv, $rootScope) {
    var promiseCached;
    var list = [];
    var timezone;

    this.init = function() {
      $rootScope.$on('refresh', this.clearCache);
    };

    this.clearCache = function() {
      promiseCached = null;
      list = [];
    };

    this.getAnnotations = function(rangeUnparsed, dashboard) {
      if (!dashboard.annotations.enable) {
        return $q.when(null);
      }

      if (promiseCached) {
        return promiseCached;
      }

      timezone = dashboard.timezone;
      var annotations = _.where(dashboard.annotations.list, { enable: true });

      var promises  = _.map(annotations, function(annotation) {
        var datasource = datasourceSrv.get(annotation.datasource);

        return datasource.annotationQuery(annotation, rangeUnparsed)
          .then(this.receiveAnnotationResults)
          .then(null, errorHandler);
      }, this);

      promiseCached = $q.all(promises)
        .then(function() {
          return list;
        });

      return promiseCached;
    };

    this.receiveAnnotationResults = function(results) {
      for (var i = 0; i < results.length; i++) {
        addAnnotation(results[i]);
      }
    };

    function errorHandler(err) {
      console.log('Annotation error: ', err);
      var message = err.message || "Aannotation query failed";
      alertSrv.set('Annotations error', message,'error');
    }

    function addAnnotation(options) {
      var tooltip = "<small><b>" + options.title + "</b><br/>";
      if (options.tags) {
        tooltip += '<span class="tag label label-tag">' + (options.tags || '') + '</span><br/>';
      }

      if (timezone === 'browser') {
        tooltip += '<i>' + moment(options.time).format('YYYY-MM-DD HH:mm:ss') + '</i><br/>';
      }
      else {
        tooltip += '<i>' + moment.utc(options.time).format('YYYY-MM-DD HH:mm:ss') + '</i><br/>';
      }

      if (options.text) {
        tooltip += options.text.replace(/\n/g, '<br/>');
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
