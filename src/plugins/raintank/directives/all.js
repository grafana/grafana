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
            console.log(scope);
            var tmpl;
            if (scope.target.value == null) {
                console.log('setting default value for: ' + scope.definition.variable);
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
                    tmpl = '<input type="checkbox" ng-true-value="true" ng-false-value="false" ng-model="target.value" class="form-control">'
                    break;
                case 'Enum':
                    tmpl = '<select ng-model="target.value" class="form-control" ng-options="e for e in definition.conditions.values" ng-required="definition.required">'
                    break;  
                default:
                    tmpl = '<input type="text" placeholder="{{definition.description}} : {{definition.data_type}}" ng-required="definition.required" ng-model="target.value" class="form-control">';

            }
            element.html(tmpl);
            $compile(element.contents())(scope);
        }
    };
  });

    module.directive('stateString', function() {
        return {
            transclude: true,
            template: '<div></div>',
            scope: {
                'object': '=object'
            },
            link: function(scope, element) {
              console.log('stateString');
              console.log(scope);
              console.log(scope[scope.object]);
              var stateMap = ['OK', 'Warning', 'Critical'];
              var stateClass = ['success', 'info', 'error'];
              scope.$watch('object.state', function(newVal) {
                  console.log('state changed to: ' + newVal);
                  element[0].innerHTML = stateMap[newVal];
                  element[0].className = "text-"+stateClass[newVal];
              });
            }
        }
    });

    module.directive('eventState', function() {
        console.log('eventState directive');
        return function(scope, element) {
          var classMap = {
            'critical': 'error',
            'warning': 'info',
            'ok': 'success'
          };
          element[0].className = classMap[scope.event.state];
        };
    });
    module.directive('panelScroll', function() {
        return function(scope, element) {
          element[0].style.overflow = 'auto';
          scope.$watch('fullscreen', function(newVal) {
            console.log('panelScroll directive');
            if (scope.fullscreen) {
              element[0].style.height = "80%";
            } else {
              var row_height = scope.row.height.replace(/\D+/g, '');
              console.log('row_height : ' + row_height);
              var newHeight =  (row_height - 30) + 'px';
              console.log("new height: " + newHeight);
              element[0].style.height = newHeight;
            }
          });
        };
    });
});