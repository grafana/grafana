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
          var template = '<div class="editor-option text-center">' +
                         ' <label for="' + attrs.name + '" class="small">' +
                           attrs.text + '</label>' +
                          '<input id="' + attrs.name + '" type="checkbox" ' +
                          '       ng-model="' + attrs.model + '"' +
                          '       ng-checked="' + attrs.model + '"></input>' +
                          ' <label for="' + attrs.name + '" class="cr1"></label>';
          elem.replaceWith($compile(angular.element(template))(scope));
        }
      };
    });

});
