define([
  'angular',
  'underscore'
],
  function (angular, _) {
    'use strict';

    var module = angular.module('kibana.controllers');

    var metricList = null;

    module.controller('KairosDBTargetCtrl', function($scope) {

      $scope.init = function() {
        $scope.panel.stack = false;
        if (!$scope.target.downsampling) {
          $scope.target.downsampling = 'avg';
        }
        $scope.target.errors = validateTarget($scope.target);
      };

      $scope.targetBlur = function() {
        $scope.target.errors = validateTarget($scope.target);
        if (!_.isEqual($scope.oldTarget, $scope.target) && _.isEmpty($scope.target.errors)) {
          $scope.oldTarget = angular.copy($scope.target);
          $scope.get_data();
        }
      };

      $scope.duplicate = function() {
        var clone = angular.copy($scope.target);
        $scope.panel.targets.push(clone);
      };

      //////////////////////////////
      // SUGGESTION QUERIES
      //////////////////////////////

      $scope.suggestMetrics = function(query, callback) {
        if (!metricList) {
          $scope.updateMetricList();
        }
        else {
          callback(metricList);
        }

      };

      $scope.updateMetricList = function() {
        $scope.metricListLoading = true;
        metricList = [];
        $scope.datasource.performMetricSuggestQuery().then(function(series) {
          metricList = series;
          $scope.metricListLoading = false;
          return metricList;
        });
      };

      $scope.suggestTagKeys = function(query, callback) {
        $scope.updateTimeRange();
        callback($scope.datasource
          .performTagSuggestQuery($scope.target.metric,$scope.rangeUnparsed, 'key',''));

      };

      $scope.suggestTagValues = function(query, callback) {
        callback($scope.datasource
          .performTagSuggestQuery($scope.target.metric,$scope.rangeUnparsed, 'value',$scope.target.currentTagKey));
      };

      //////////////////////////////
      // FILTER by TAG
      //////////////////////////////

      $scope.addFilterTag = function() {
        if (!$scope.addFilterTagMode) {
          $scope.addFilterTagMode = true;
          $scope.validateFilterTag();
          return;
        }

        if (!$scope.target.tags) {
          $scope.target.tags = {};
        }

        $scope.validateFilterTag();
        if (!$scope.target.errors.tags) {
          if(!_.has($scope.target.tags,$scope.target.currentTagKey)) {
            $scope.target.tags[$scope.target.currentTagKey] = [];
          }
          $scope.target.tags[$scope.target.currentTagKey].push($scope.target.currentTagValue);
          $scope.target.currentTagKey = '';
          $scope.target.currentTagValue = '';
          $scope.targetBlur();
        }

        $scope.addFilterTagMode = false;
      };

      $scope.removeFilterTag = function(key) {
        delete $scope.target.tags[key];
        if(_.size($scope.target.tags)===0) {
          $scope.target.tags = null;
        }
        $scope.targetBlur();
      };

      $scope.validateFilterTag = function() {
        $scope.target.errors.tags = null;
        if(!$scope.target.currentTagKey || !$scope.target.currentTagValue) {
          $scope.target.errors.tags = "You must specify a tag name and value.";
        }
      };

      //////////////////////////////
      // GROUP BY
      //////////////////////////////

      $scope.addGroupBy = function() {
        if (!$scope.addGroupByMode) {
          $scope.addGroupByMode = true;
          $scope.target.currentGroupByType = 'tag';
          $scope.isTagGroupBy = true;
          $scope.validateGroupBy();
          return;
        }
        $scope.validateGroupBy();
        // nb: if error is found, means that user clicked on cross : cancels input
        if (_.isEmpty($scope.target.errors.groupBy)) {
          if($scope.isTagGroupBy) {
            if (!$scope.target.groupByTags) {
              $scope.target.groupByTags = [];
            }
            console.log($scope.target.groupBy.tagKey);
            if (!_.contains($scope.target.groupByTags, $scope.target.groupBy.tagKey)) {
              $scope.target.groupByTags.push($scope.target.groupBy.tagKey);
              $scope.targetBlur();
            }
            $scope.target.groupBy.tagKey = '';
          }
          else  {
            if (!$scope.target.nonTagGroupBys) {
              $scope.target.nonTagGroupBys = [];
            }
            var groupBy = {
              name: $scope.target.currentGroupByType
            };
            if($scope.isValueGroupBy) {groupBy.range_size = $scope.target.groupBy.valueRange;}
            else if($scope.isTimeGroupBy) {
              groupBy.range_size = $scope.target.groupBy.timeInterval;
              groupBy.group_count = $scope.target.groupBy.groupCount;
            }
            $scope.target.nonTagGroupBys.push(groupBy);
          }
          $scope.targetBlur();
        }
        $scope.isTagGroupBy = false;
        $scope.isValueGroupBy = false;
        $scope.isTimeGroupBy = false;
        $scope.addGroupByMode = false;
      };

      $scope.removeGroupByTag = function(index) {
        $scope.target.groupByTags.splice(index, 1);
        if(_.size($scope.target.groupByTags)===0) {
          $scope.target.groupByTags = null;
        }
        $scope.targetBlur();
      };

      $scope.removeNonTagGroupBy = function(index) {
        $scope.target.nonTagGroupBys.splice(index, 1);
        if(_.size($scope.target.nonTagGroupBys)===0) {
          $scope.target.nonTagGroupBys = null;
        }
        $scope.targetBlur();
      };

      $scope.changeGroupByInput = function() {
        $scope.isTagGroupBy = $scope.target.currentGroupByType==='tag';
        $scope.isValueGroupBy = $scope.target.currentGroupByType==='value';
        $scope.isTimeGroupBy = $scope.target.currentGroupByType==='time';
        $scope.validateGroupBy();
      };

      $scope.validateGroupBy = function() {
        delete $scope.target.errors.groupBy;
        var errors = {};
        $scope.isGroupByValid = true;
        if($scope.isTagGroupBy) {
          if(!$scope.target.groupBy.tagKey) {
            $scope.isGroupByValid = false;
            errors.tagKey = 'You must supply a tag name';
          }
        }
        if($scope.isValueGroupBy) {
          if(!$scope.target.groupBy.valueRange || !isInt($scope.target.groupBy.valueRange)) {
            errors.valueRange = "Range must be an integer";
            $scope.isGroupByValid = false;
          }
        }
        if($scope.isTimeGroupBy) {
          try {
            $scope.datasource.convertToKairosInterval($scope.target.groupBy.timeInterval);
          } catch(err) {
            errors.timeInterval = err.message;
            $scope.isGroupByValid = false;
          }
          if(!$scope.target.groupBy.groupCount || !isInt($scope.target.groupBy.groupCount)) {
            errors.groupCount = "Group count must be an integer";
            $scope.isGroupByValid = false;
          }
        }

        if(!_.isEmpty(errors)) {
          $scope.target.errors.groupBy = errors;
        }
      };

      function isInt(n) {
        return parseInt(n) % 1 === 0;
      }

      //////////////////////////////
      // HORIZONTAL AGGREGATION
      //////////////////////////////

      $scope.addHorizontalAggregator = function() {
        if (!$scope.addHorizontalAggregatorMode) {
          $scope.addHorizontalAggregatorMode = true;
          $scope.target.currentHorizontalAggregatorName = 'avg';
          $scope.hasSamplingRate = true;
          $scope.validateHorizontalAggregator();
          return;
        }

        $scope.validateHorizontalAggregator();
        // nb: if error is found, means that user clicked on cross : cancels input
        if(_.isEmpty($scope.target.errors.horAggregator)) {
          if (!$scope.target.horizontalAggregators) {
            $scope.target.horizontalAggregators = [];
          }
          var aggregator = {
            name:$scope.target.currentHorizontalAggregatorName
          };
          if($scope.hasSamplingRate) {aggregator.sampling_rate = $scope.target.horAggregator.samplingRate;}
          if($scope.hasUnit) {aggregator.unit = $scope.target.horAggregator.unit;}
          if($scope.hasFactor) {aggregator.factor = $scope.target.horAggregator.factor;}
          if($scope.hasPercentile) {aggregator.percentile = $scope.target.horAggregator.percentile;}
          $scope.target.horizontalAggregators.push(aggregator);
          $scope.targetBlur();
        }

        $scope.addHorizontalAggregatorMode = false;
        $scope.hasSamplingRate = false;
        $scope.hasUnit = false;
        $scope.hasFactor = false;
        $scope.hasPercentile = false;

      };

      $scope.removeHorizontalAggregator = function(index) {
        $scope.target.horizontalAggregators.splice(index, 1);
        if(_.size($scope.target.horizontalAggregators)===0) {
          $scope.target.horizontalAggregators = null;
        }

        $scope.targetBlur();
      };

      $scope.changeHorAggregationInput = function() {
        $scope.hasSamplingRate = _.contains(['avg','dev','max','min','sum','least_squares','count','percentile'],
          $scope.target.currentHorizontalAggregatorName);
        $scope.hasUnit = _.contains(['sampler','rate'], $scope.target.currentHorizontalAggregatorName);
        $scope.hasFactor = _.contains(['div','scale'], $scope.target.currentHorizontalAggregatorName);
        $scope.hasPercentile = 'percentile'===$scope.target.currentHorizontalAggregatorName;
        $scope.validateHorizontalAggregator();
      };

      $scope.validateHorizontalAggregator = function() {
        delete $scope.target.errors.horAggregator;
        var errors = {};
        $scope.isAggregatorValid = true;
        if($scope.hasSamplingRate) {
          try {
            $scope.datasource.convertToKairosInterval($scope.target.horAggregator.samplingRate);
          } catch(err) {
            errors.samplingRate = err.message;
            $scope.isAggregatorValid = false;
          }
        }
        if($scope.hasFactor) {
          if(!$scope.target.horAggregator.factor) {
            errors.factor = 'You must supply a numeric value for this aggregator';
            $scope.isAggregatorValid = false;
          }
          else if(parseInt($scope.target.horAggregator.factor)===0 && $scope.target.currentHorizontalAggregatorName==='div') {
            errors.factor = 'Cannot divide by 0';
            $scope.isAggregatorValid = false;
          }
        }
        if($scope.hasPercentile) {
          if(!$scope.target.horAggregator.percentile ||
            $scope.target.horAggregator.percentile<=0 ||
            $scope.target.horAggregator.percentile>1) {
            errors.percentile = 'Percentile must be between 0 and 1';
            $scope.isAggregatorValid = false;
          }
        }

        if(!_.isEmpty(errors)) {
          $scope.target.errors.horAggregator = errors;
        }
      };

      $scope.alert = function(message) {
        alert(message);
      };

      //////////////////////////////
      // VALIDATION
      //////////////////////////////

      function validateTarget(target) {
        var errs = {};

        if (!target.metric) {
          errs.metric = "You must supply a metric name.";
        }

        try {
          if (target.sampling) {
            $scope.datasource.convertToKairosInterval(target.sampling);
          }
        } catch(err) {
          errs.sampling = err.message;
        }

        return errs;
      }

    });

  });