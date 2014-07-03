define([
  'angular',
  'underscore',
  'jquery',
],
function (angular, _, $) {
  'use strict';

  angular
    .module('kibana.directives')
    .directive('dalmatinerdbFuncEditor', function($compile) {

      var funcSpanTemplate = '<a gf-dropdown="functionMenu" class="dropdown-toggle" ' +
                             'data-toggle="dropdown">{{target.function}}</a><span>';

      return {
        restrict: 'A',
        link: function postLink($scope, elem) {
          var $funcLink = $(funcSpanTemplate);

          $scope.functionMenu = _.map($scope.functions, function(func) {
            return {
              text: func,
              click: "changeFunction('" + func + "');"
            };
          });

          function addElementsAndCompile() {
            $funcLink.appendTo(elem);
            $compile(elem.contents())($scope);
          }

          addElementsAndCompile();

        }
      };

    });

});
