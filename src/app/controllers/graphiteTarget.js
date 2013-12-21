define([
  'angular',
  'underscore',
  'config'
],
function (angular, _, config) {
  'use strict';

  var module = angular.module('kibana.controllers');
  var graphiteFunctions = [
    {
      name: "scaleToSeconds",
      params: [ { name: "seconds", type: "int" } ]
    },
    {
      name: "sumSeries",
      params: []
    },
    {
      name: "groupByNode",
      params: [ { name: "node", type: "node" }, { name: "function", type: "function" }]
    }
  ];

  module.controller('GraphiteTargetCtrl', function($scope, $http) {

    $scope.init = function() {
      $scope.segments = _.map($scope.target.target.split('.'), function (segmentStr) {
        return {
          val: segmentStr,
          html: segmentStr === '*' ? '<i class="icon-asterisk"><i>' : segmentStr
        };
      });

      $scope.functions = [
        {
          text: "scaleToSeconds(1)",
          def: graphiteFunctions[0],
          params: {
            seconds: 1
          }
        },
        {
          text: "groupByNode",
          def: graphiteFunctions[2],
          params: {

          }
        }
      ];
    };

    function getSegmentPathUpTo(index) {
      var arr = $scope.segments.slice(0, index);

      return _.reduce(arr, function(result, segment) {
        return result ? (result + "." + segment.val) : segment.val;
      }, null);
    }

    function graphiteMetricQuery(query) {
      var url = config.graphiteUrl + '/metrics/find/?query=' + query;
      return $http.get(url);
    }

    function checkOtherSegments(fromIndex) {
      var path = getSegmentPathUpTo(fromIndex + 1);
      return graphiteMetricQuery(path)
        .then(function(result) {
          if (result.data.length === 0) {
            $scope.segments = $scope.segments.splice(0, fromIndex);
            $scope.segments.push({html: 'select metric'});
            return;
          }
          if (result.data[0].expandable) {
            if ($scope.segments.length === fromIndex) {
              $scope.segments.push({html: 'select metric'});
            }
            else {
              return checkOtherSegments(fromIndex + 1);
            }
          }
        });
    }

    function setSegmentFocus(segmentIndex) {
      _.each($scope.segments, function(segment, index) {
        segment.focus = segmentIndex == index;
      });
    }

    $scope.getAltSegments = function (index) {
      $scope.altSegments = [];

      return graphiteMetricQuery(getSegmentPathUpTo(index) + '.*')
        .then(function(result) {
          var altSegments = _.map(result.data, function(altSegment) {
            return {
              val: altSegment.text,
              html: altSegment.text,
              expandable: altSegment.expandable
            }
          });

          altSegments.unshift({val: '*', html: '<i class="icon-asterisk"></i>' })
          $scope.altSegments = altSegments;
        });
    };

    $scope.setSegment = function (altIndex, segmentIndex) {
      $scope.segments[segmentIndex].val = $scope.altSegments[altIndex].val;
      $scope.segments[segmentIndex].html = $scope.altSegments[altIndex].html;

      if ($scope.altSegments[altIndex].expandable) {
        return checkOtherSegments(segmentIndex + 1)
          .then(function () {
            setSegmentFocus(segmentIndex + 1);
            $scope.targetChanged();
          });
      }

      setSegmentFocus(segmentIndex + 1);
      $scope.targetChanged();
    };

    $scope.targetChanged = function() {
      $scope.target.target = getSegmentPathUpTo($scope.segments.length);
      $scope.$parent.get_data();
    };

    $scope.removeFunction = function(func) {
      $scope.functions = _.without($scope.functions, func);
    };

    $scope.functionParamsChanged = function(func) {
      func.text = func.def.name + '(';
      _.each(func.def.params, function(param) {
        func.text += func.params[param.name];
      });
      func.text += ')';
    };

    $scope.addFunction = function() {
      console.log($scope.functions);
    };

    $scope.editFunction = function(func) {
      //func.edit = true;
    };

  });

  module.directive('focusMe', function($timeout, $parse) {
    return {
      //scope: true,   // optionally create a child scope
      link: function(scope, element, attrs) {
        var model = $parse(attrs.focusMe);
        scope.$watch(model, function(value) {
          console.log('value=',value);
          if(value === true) {
            $timeout(function() {
              element[0].focus();
            });
          }
        });
    /*    // to address @blesh's comment, set attribute value to 'false'
        // on blur event:
        element.bind('blur', function() {
           console.log('blur');
           scope.$apply(model.assign(scope, false));
        });*/
      }
    };
  });

});