define([
  'angular',
  'lodash'
],
function (angular, _) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('InfluxQueryCtrl', function($scope, $timeout, $sce, templateSrv, $q) {

    $scope.init = function() {
      $scope.segments = $scope.target.segments || [];

      $scope.functionsSelect = [
        'count', 'mean', 'sum', 'min',
        'max', 'mode', 'distinct', 'median',
        'derivative', 'stddev', 'first', 'last',
        'difference'
      ];

      checkOtherSegments(0);
    };

    $scope.toggleQueryMode = function () {
      $scope.target.rawQuery = !$scope.target.rawQuery;
    };

    $scope.moveMetricQuery = function(fromIndex, toIndex) {
      _.move($scope.panel.targets, fromIndex, toIndex);
    };

    $scope.duplicate = function() {
      var clone = angular.copy($scope.target);
      $scope.panel.targets.push(clone);
    };

    $scope.getAltSegments = function (index) {
      $scope.altSegments = [];

      var measurement = $scope.segments[0].value;
      var queryType, query;
      if (index === 0) {
        queryType = 'MEASUREMENTS';
        query = 'SHOW MEASUREMENTS';
      } else if (index % 2 === 1) {
        queryType = 'TAG_KEYS';
        query = 'SHOW TAG KEYS FROM ' + measurement;
      } else {
        queryType = 'TAG_VALUES';
        query = "SHOW TAG VALUES FROM " + measurement + " WITH KEY = " + $scope.segments[$scope.segments.length - 2].value;
      }

      console.log('getAltSegments: query' , query);

      return $scope.datasource.metricFindQuery(query, queryType).then(function(results) {
        console.log('get alt segments: response', results);
        $scope.altSegments = _.map(results, function(segment) {
          return new MetricSegment({ value: segment.text, expandable: segment.expandable });
        });

        _.each(templateSrv.variables, function(variable) {
          $scope.altSegments.unshift(new MetricSegment({
            type: 'template',
            value: '$' + variable.name,
            expandable: true,
          }));
        });
      }, function(err) {
        $scope.parserError = err.message || 'Failed to issue metric query';
      });
    };

    $scope.segmentValueChanged = function (segment, segmentIndex) {
      delete $scope.parserError;

      if (segment.expandable) {
        return checkOtherSegments(segmentIndex + 1).then(function () {
          setSegmentFocus(segmentIndex + 1);
          $scope.targetChanged();
        });
      }
      else {
        $scope.segments = $scope.segments.splice(0, segmentIndex + 1);
      }

      setSegmentFocus(segmentIndex + 1);
      $scope.targetChanged();
    };

    $scope.targetChanged = function() {
      if ($scope.parserError) {
        return;
      }

      $scope.$parent.get_data();
    };

    function checkOtherSegments(fromIndex) {
      if (fromIndex === 0) {
        $scope.segments.push(MetricSegment.newSelectMetric());
        return;
      }

      if ($scope.segments.length === 0) {
        throw('should always have a scope segment?');
      }

      if (_.last($scope.segments).fake) {
        return $q.when([]);
      } else if ($scope.segments.length % 2 === 1) {
        $scope.segments.push(MetricSegment.newSelectTag());
        return $q.when([]);
      } else {
        $scope.segments.push(MetricSegment.newSelectTagValue());
        return $q.when([]);
      }
    }

    function setSegmentFocus(segmentIndex) {
      _.each($scope.segments, function(segment, index) {
        segment.focus = segmentIndex === index;
      });
    }

    function MetricSegment(options) {
      if (options === '*' || options.value === '*') {
        this.value = '*';
        this.html = $sce.trustAsHtml('<i class="fa fa-asterisk"><i>');
        this.expandable = true;
        return;
      }

      if (_.isString(options)) {
        this.value = options;
        this.html = $sce.trustAsHtml(this.value);
        return;
      }

      this.fake = options.fake;
      this.value = options.value;
      this.type = options.type;
      this.expandable = options.expandable;
      this.html = $sce.trustAsHtml(templateSrv.highlightVariablesAsHtml(this.value));
    }

    MetricSegment.newSelectMetric = function() {
      return new MetricSegment({value: 'select metric', fake: true});
    };

    MetricSegment.newSelectTag = function() {
      return new MetricSegment({value: 'select tag', fake: true});
    };

    MetricSegment.newSelectTagValue = function() {
      return new MetricSegment({value: 'select tag value', fake: true});
    };

  });

});
