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
          var _t = '<i class="grafana-tip fa fa-'+(attrs.icon||'question-circle')+'" bs-tooltip="\''+
            kbn.addslashes(elem.text())+'\'"></i>';
          elem.replaceWith($compile(angular.element(_t))(scope));
        }
      };
    });

  angular
    .module('grafana.directives')
    .directive('watchChange', function() {
      return {
        scope: { onchange: '&watchChange' },
        link: function(scope, element) {
          element.on('input', function() {
            scope.$apply(function () {
              scope.onchange({ inputValue: element.val() });
            });
          });
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
          var showIf = attrs.showIf ? (' ng-show="' + attrs.showIf + '" ') : '';

          var template = '<div class="editor-option text-center"' + showIf + '>' +
                         ' <label for="' + attrs.model + '" class="small">' +
                           attrs.text + tip + '</label>' +
                          '<input class="cr1" id="' + attrs.model + '" type="checkbox" ' +
                          '       ng-model="' + attrs.model + '"' + ngchange +
                          '       ng-checked="' + attrs.model + '"></input>' +
                          ' <label for="' + attrs.model + '" class="cr1"></label>';
          elem.replaceWith($compile(angular.element(template))(scope));
        }
      };
    });

  angular
    .module('grafana.directives')
    .directive('editorCheckbox', function($compile, $interpolate) {
      return {
        restrict: 'E',
        link: function(scope, elem, attrs) {
          var text = $interpolate(attrs.text)(scope);
          var ngchange = attrs.change ? (' ng-change="' + attrs.change + '"') : '';
          var tip = attrs.tip ? (' <tip>' + attrs.tip + '</tip>') : '';
          var label = '<label for="' + scope.$id + attrs.model + '" class="checkbox-label">' +
                           text + tip + '</label>';

          var template = '<input class="cr1" id="' + scope.$id + attrs.model + '" type="checkbox" ' +
                          '       ng-model="' + attrs.model + '"' + ngchange +
                          '       ng-checked="' + attrs.model + '"></input>' +
                          ' <label for="' + scope.$id + attrs.model + '" class="cr1"></label>';

          if (attrs.position === "front") {
            template = label + template;
          } else {
            template = template + label;
          }

          elem.replaceWith($compile(angular.element(template))(scope));
        }
      };
    });

});
