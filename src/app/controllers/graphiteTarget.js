define([
  'angular',
  'underscore',
  'config',
  '../services/graphite/gfunc',
  '../services/graphite/parser'
],
function (angular, _, config, gfunc, Parser) {
  'use strict';

  var module = angular.module('kibana.controllers');

  module.controller('GraphiteTargetCtrl', function($scope) {

    $scope.init = function() {
      $scope.target.target = $scope.target.target || '';

      parseTarget();
    };

    // The way parsing and the target editor works needs
    // to be rewritten to handle functions that take multiple series
    function parseTarget() {
      $scope.functions = [];
      $scope.segments = [];
      $scope.showTextEditor = false;

      delete $scope.parserError;

      var parser = new Parser($scope.target.target);
      var astNode = parser.getAst();
      if (astNode === null) {
        checkOtherSegments(0);
        return;
      }

      if (astNode.type === 'error') {
        $scope.parserError = astNode.message + " at position: " + astNode.pos;
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

      checkOtherSegments($scope.segments.length - 1);
    }

    function parseTargeRecursive(astNode, func, index) {
      if (astNode === null) {
        return null;
      }

      switch(astNode.type) {
      case 'function':
        var innerFunc = gfunc.createFuncInstance(astNode.name);

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

        if (index === 0) {
          func.params[index] = astNode.value;
        }
        else {
          func.params[index - 1] = astNode.value;
        }

        break;

      case 'metric':
        if ($scope.segments.length > 0) {
          throw { message: 'Multiple metric params not supported, use text editor.' };
        }

        $scope.segments = _.map(astNode.segments, function(segment) {
          var node = {
            type: segment.type,
            val: segment.value,
            html: segment.value
          };
          if (segment.value === '*') {
            node.html = '<i class="icon-asterisk"><i>';
          }
          if (segment.type === 'template') {
            node.val = node.html = '[[' + segment.value + ']]';
            node.html = "<span style='color: #ECEC09'>" + node.html + "</span>";
          }
          return node;
        });
      }
    }

    function getSegmentPathUpTo(index) {
      var arr = $scope.segments.slice(0, index);

      return _.reduce(arr, function(result, segment) {
        return result ? (result + "." + segment.val) : segment.val;
      }, "");
    }

    function checkOtherSegments(fromIndex) {
      if (fromIndex === 0) {
        $scope.segments.push({html: 'select metric'});
        return;
      }

      var path = getSegmentPathUpTo(fromIndex + 1);
      return $scope.datasource.metricFindQuery($scope.filter, path)
        .then(function(segments) {
          if (segments.length === 0) {
            $scope.segments = $scope.segments.splice(0, fromIndex);
            $scope.segments.push({html: 'select metric'});
            return;
          }
          if (segments[0].expandable) {
            if ($scope.segments.length === fromIndex) {
              $scope.segments.push({html: 'select metric'});
            }
            else {
              return checkOtherSegments(fromIndex + 1);
            }
          }
        })
        .then(null, function(err) {
          $scope.parserError = err.message || 'Failed to issue metric query';
        });
    }

    function setSegmentFocus(segmentIndex) {
      _.each($scope.segments, function(segment, index) {
        segment.focus = segmentIndex === index;
      });
    }

    function wrapFunction(target, func) {
      return func.render(target);
    }

    $scope.getAltSegments = function (index) {
      $scope.altSegments = [];

      var query = index === 0 ?
        '*' : getSegmentPathUpTo(index) + '.*';

      return $scope.datasource.metricFindQuery($scope.filter, query)
        .then(function(segments) {
          _.each(segments, function(segment) {
            segment.html = segment.val = segment.text;
          });

          _.each($scope.filter.templateParameters, function(templateParameter) {
            segments.unshift({
              type: 'template',
              html: '[[' + templateParameter.name + ']]',
              val: '[[' + templateParameter.name + ']]',
              expandable: true,
            });
          });

          segments.unshift({val: '*', html: '<i class="icon-asterisk"></i>', expandable: true });
          $scope.altSegments = segments;
        })
        .then(null, function(err) {
          $scope.parserError = err.message || 'Failed to issue metric query';
        });
    };

    $scope.setSegment = function (altIndex, segmentIndex) {
      delete $scope.parserError;

      $scope.segments[segmentIndex].val = $scope.altSegments[altIndex].val;
      $scope.segments[segmentIndex].html = $scope.altSegments[altIndex].html;

      if ($scope.altSegments[altIndex].expandable) {
        return checkOtherSegments(segmentIndex + 1)
          .then(function () {
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

    $scope.targetTextChanged = function() {
      parseTarget();
      $scope.$parent.get_data();
    };

    $scope.targetChanged = function() {
      if ($scope.parserError) {
        return;
      }

      var oldTarget = $scope.target.target;

      var target = getSegmentPathUpTo($scope.segments.length);
      $scope.target.target = _.reduce($scope.functions, wrapFunction, target);

      if ($scope.target.target !== oldTarget) {
        $scope.$parent.get_data();
      }
    };

    $scope.removeFunction = function(func) {
      $scope.functions = _.without($scope.functions, func);
      $scope.targetChanged();
    };

    $scope.addFunction = function(funcDef) {
      var newFunc = gfunc.createFuncInstance(funcDef);
      newFunc.added = true;
      $scope.functions.push(newFunc);

      $scope.moveAliasFuncLast();
      $scope.smartlyHandleNewAliasByNode(newFunc);

      if (!newFunc.params.length && newFunc.added) {
        $scope.targetChanged();
      }
    };

    $scope.moveAliasFuncLast = function() {
      var aliasFunc = _.find($scope.functions, function(func) {
        return func.def.name === 'alias' ||
               func.def.name === 'aliasByNode' ||
               func.def.name === 'aliasByMetric';
      });

      if (aliasFunc) {
        $scope.functions = _.without($scope.functions, aliasFunc);
        $scope.functions.push(aliasFunc);
      }
    };

    $scope.smartlyHandleNewAliasByNode = function(func) {
      if (func.def.name !== 'aliasByNode') {
        return;
      }
      for(var i = 0; i < $scope.segments.length; i++) {
        if ($scope.segments[i].val.indexOf('*') >= 0)  {
          func.params[0] = i;
          func.added = false;
          $scope.targetChanged();
          return;
        }
      }
    };

    $scope.duplicate = function() {
      var clone = angular.copy($scope.target);
      $scope.panel.targets.push(clone);
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
