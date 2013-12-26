define([
  'angular',
  'underscore',
  'config',
  '../services/graphite/graphiteFuncs',
  '../services/graphite/parser'
],
function (angular, _, config, graphiteFuncs, Parser) {
  'use strict';

  var module = angular.module('kibana.controllers');

  module.controller('GraphiteTargetCtrl', function($scope, $http) {

    $scope.init = function() {
      $scope.funcDefs = graphiteFuncs.getDefList();
      parseTarget();
    };

    function parseTarget() {
      $scope.functions = [];
      $scope.segments = [];
      $scope.showTextEditor = false;

      delete $scope.parserError;

      var parser = new Parser($scope.target.target);
      var astNode = parser.getAst();

      if (parser.error) {
        $scope.parserError = parser.error.text + " at position: " + parser.error.pos;
        $scope.showTextEditor = true;
        return;
      }

      try {
        parseTargeRecursive(astNode);
      }
      catch (err) {
        console.log('error parsing target:', err.message);
        $scope.parserError = err.message;
        $scope.showTextEditor = true;
      }

      checkOtherSegments($scope.segments.length);
    }

    function parseTargeRecursive(astNode, func, index) {
      if (astNode === null) {
        return null;
      }

      switch(astNode.type) {
      case 'function':
        var innerFunc = graphiteFuncs.createFuncInstance(astNode.name);

        _.each(astNode.params, function(param, index) {
          parseTargeRecursive(param, innerFunc, index);
        });

        innerFunc.updateText();
        $scope.functions.push(innerFunc);
        break;

      case 'string':
      case 'number':
        if ((index-1) >= func.def.params.length) {
          throw { message: 'invalid number of parameters to method ' + func.def.name };
        }

        func.params[index - 1] = astNode.value;
        break;

      case 'metric':
        if ($scope.segments.length > 0) {
          throw { message: 'Multiple metric params not supported, use text editor.' };
        }

        $scope.segments = _.map(astNode.segments, function(segment) {
          return {
            val: segment.value,
            html: segment.value === '*' ? '<i class="icon-asterisk"><i>' : segment.value
          };
        });
      }
    }

    function getSegmentPathUpTo(index) {
      var arr = $scope.segments.slice(0, index);

      return _.reduce(arr, function(result, segment) {
        return result ? (result + "." + segment.val) : segment.val;
      }, "");
    }

    function graphiteMetricQuery(query) {
      var url = config.graphiteUrl + '/metrics/find/?query=' + query;
      return $http.get(url);
    }

    function checkOtherSegments(fromIndex) {
      if (fromIndex === 0) {
        $scope.segments.push({html: 'select metric'});
        return;
      }

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
        segment.focus = segmentIndex === index;
      });
    }

    function wrapFunction(target, func) {
      var targetWrapped = func.def.name + '(' + target;
      _.each(func.params, function(param) {
        if (_.isString(param)) {
          targetWrapped += ",'" + param + "'";
        }
        else {
          targetWrapped += "," + param;
        }
      });
      return targetWrapped + ')';
    }

    $scope.getAltSegments = function (index) {
      $scope.altSegments = [];

      var query = index === 0 ?
        '*' : getSegmentPathUpTo(index) + '.*';

      return graphiteMetricQuery(query)
        .then(function(result) {
          var altSegments = _.map(result.data, function(altSegment) {
            return {
              val: altSegment.text,
              html: altSegment.text,
              expandable: altSegment.expandable
            };
          });

          altSegments.unshift({val: '*', html: '<i class="icon-asterisk"></i>' });
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

    $scope.targetTextChanged = function() {
      parseTarget();
      $scope.$parent.get_data();
    };

    $scope.targetChanged = function() {
      if ($scope.parserError) {
        return;
      }

      var target = getSegmentPathUpTo($scope.segments.length);
      target = _.reduce($scope.functions, wrapFunction, target);
      $scope.target.target = target;
      $scope.$parent.get_data();
    };

    $scope.removeFunction = function(func) {
      $scope.functions = _.without($scope.functions, func);
      $scope.targetChanged();
    };

    $scope.functionParamsChanged = function(func) {
      func.updateText();
      $scope.targetChanged();
    };

    $scope.addFunction = function(funcDef) {
      $scope.functions.push(graphiteFuncs.createFuncInstance(funcDef));
      $scope.targetChanged();
    };

  });

  module.directive('focusMe', function($timeout, $parse) {
    return {
      //scope: true,   // optionally create a child scope
      link: function(scope, element, attrs) {
        var model = $parse(attrs.focusMe);
        scope.$watch(model, function(value) {
          if(value === true) {
            $timeout(function() {
              element[0].focus();
            });
          }
        });
      }
    };
  });

});