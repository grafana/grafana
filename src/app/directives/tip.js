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

  angular
    .module('grafana.directives')
    .directive('editorOptBool', function($compile) {
      return {
        restrict: 'E',
        link: function(scope, elem, attrs) {
          var ngchange = attrs.change ? (' ng-change="' + attrs.change + '"') : '';
          var tip = attrs.tip ? (' <tip>' + attrs.tip + '</tip>') : '';

          var template = '<div class="editor-option text-center">' +
                         ' <label for="' + attrs.model + '" class="small">' +
                           attrs.text + tip + '</label>' +
                          '<input id="' + attrs.model + '" type="checkbox" ' +
                          '       ng-model="' + attrs.model + '"' + ngchange +
                          '       ng-checked="' + attrs.model + '"></input>' +
                          ' <label for="' + attrs.model + '" class="cr1"></label>';
          elem.replaceWith($compile(angular.element(template))(scope));
        }
      };
    });

});
