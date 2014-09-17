define([
  'angular',
  'kbn'
],
function (angular, kbn) {
  'use strict';

  angular
    .module('grafana.directives')
    .directive('tip', function($compile) {
      return {
        restrict: 'E',
        link: function(scope, elem, attrs) {
          var _t = '<i class="grafana-tip icon-'+(attrs.icon||'question-sign')+'" bs-tooltip="\''+
            kbn.addslashes(elem.text())+'\'"></i>';
          elem.replaceWith($compile(angular.element(_t))(scope));
        }
      };
    });
});
