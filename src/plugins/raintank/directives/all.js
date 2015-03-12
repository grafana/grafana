define([
  'angular',
  'lodash'
], function (angular, _) {
  var module = angular.module('grafana.directives');

  module.directive('raintankSetting', function ($compile) {
    return {
      transclude: true,
      restrict: 'E',
      scope: {
        definition: '=',
        target: '='
      },
      template: '<div></div>',
      replace: true,
      link: function(scope,element, attrs) {
        var tmpl;
        if (scope.target.value == null) {
          scope.target.value = scope.definition.default_value;
        }
        switch (scope.definition.data_type) {
          case 'String':
            tmpl = '<input type="text" placeholder="{{definition.description}}" ng-required="definition.required" ng-model="target.value" class="form-control">';
            break;
          case 'Text':
            tmpl = '<textarea placeholder="{{definition.description}}" ng-required="definition.required" ng-model="target.value" class="form-control">';
            break;
          case 'Number':
            scope.target.value = parseFloat(scope.target.value).toString();
            tmpl = '<input type="text" placeholder="{{definition.description}}" ng-required="definition.required" ng-model="target.value" class="form-control">';
            break;
          case 'Boolean':
            tmpl = '<input type="checkbox" ng-true-value="\'true\'" ng-false-value="\'false\'" ng-model="target.value" class="form-control">';
            break;
          case 'Enum':
            tmpl = '<select ng-model="target.value" class="form-control" ng-options="e for e in definition.conditions.values" ng-required="definition.required">';
            break;
          default:
            tmpl = '<input type="text" placeholder="{{definition.description}} : {{definition.data_type}}" ng-required="definition.required" ng-model="target.value" class="form-control">';
        }
        element.html(tmpl);
        $compile(element.contents())(scope);
      }
    };
  });

  module.directive('panelScroll', function() {
    return function(scope, element) {
      element[0].style.overflow = 'auto';
      scope.$watch('fullscreen', function(newVal) {
        if (scope.fullscreen) {
          element[0].style.height = "80%";
        } else {
          var row_height = scope.row.height.replace(/\D+/g, '');
          var newHeight =  (row_height - 30) + 'px';
          element[0].style.height = newHeight;
        }
      });
    };
  });
});