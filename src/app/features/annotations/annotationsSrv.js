define([
  'angular',
  'lodash',
  'moment',
  './editorCtrl'
], function (angular, _, moment) {
  'use strict';

  var module = angular.module('grafana.services');

  module.service('annotationsSrv', function(datasourceSrv, $q, alertSrv, $rootScope, $sanitize) {
    var promiseCached;
    var list = []; // for point in time annotations
    var markings = []; // for regions
    var timezone;
    var self = this;

    this.init = function() {
      $rootScope.onAppEvent('refresh', this.clearCache);
      $rootScope.onAppEvent('setup-dashboard', this.clearCache);
      $rootScope.onAppEvent('marked-region', this.saveAndAddMarking);
    };

    this.clearCache = function() {
      promiseCached = null;
      list = [];
      markings = [];
    };

    this.saveAndAddMarking = function(marking) {
      self.addMarking(marking);
      dataSourceSrv.get("es").then(function(datasource) {
          return datasource.saveMarking(marking)
          .then(null, markingsErrorHandler);
        }, this);
    };

    this.getAnnotations = function(rangeUnparsed, dashboard) {
      if (!dashboard.annotations.enable) {
        return $q.when(null);
      }

      if (promiseCached) {
        return promiseCached;
      }

      timezone = dashboard.timezone;
      var annotations = _.where(dashboard.annotations.list, {enable: true});

      var promises  = _.map(annotations, function(annotation) {
        return datasourceSrv.get(annotation.datasource).then(function(datasource) {
          return datasource.annotationQuery(annotation, rangeUnparsed)
            .then(self.receiveAnnotationResults)
            .then(null, errorHandler);
        }, this);
      });

      var marking = {
        datasource :"es"
      }

      promises.push(
        dataSourceSrv.get(marking.datasource).then(function(datasource) {
          return datasource.markingsQuery(marking, rangeUnparsed)
          .then(self.receiveMarkingsResults)
          .then(null, markingsErrorHandler);
        }, this)
      );


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
    this.receiveMarkingsResults = function(results) {
      for (var i = 0; i < results.length; i++) {
        addMarking(results[i]);
      }
    };

    function errorHandler(err) {
      console.log('Annotation error: ', err);
      var message = err.message || "Annotation query failed";
      alertSrv.set('Annotations error', message,'error');
    }

    function markingsErrorHandler(err) {
      console.log('Markings error: ', err);
      var message = err.message || "Markings query failed";
      alertSrv.set('Markings error', message,'error');
    }

    function addAnnotation(options) {
      var title = $sanitize(options.title);
      var tooltip = "<small><b>" + title + "</b><br/>";
      if (options.tags) {
        var tags = $sanitize(options.tags);
        tooltip += '<span class="tag label label-tag">' + (tags || '') + '</span><br/>';
      }

      if (timezone === 'browser') {
        tooltip += '<i>' + moment(options.time).format('YYYY-MM-DD HH:mm:ss') + '</i><br/>';
      }
      else {
        tooltip += '<i>' + moment.utc(options.time).format('YYYY-MM-DD HH:mm:ss') + '</i><br/>';
      }

      if (options.text) {
        var text = $sanitize(options.text);
        tooltip += text.replace(/\n/g, '<br/>');
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

    this.addMarking = function(options) {
      var colors = {
        ok: "#003300",
        warn:"#B26B00",
        crit: "#880000"
      }
      markings.push({
        xaxis: {
          from: options.from,
          to:options.to
        },
        color: colors[options.state]
      });
    }

    // Now init
    this.init();
  });

});
