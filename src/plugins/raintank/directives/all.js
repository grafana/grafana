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

  module.directive('endpointCollectorSelect', function($compile, $window, $timeout) {
    return {
      scope: {
        collectors: "=",
        model: "=",
      },
      templateUrl: 'plugins/raintank/directives/partials/endpointCollectorSelect.html',
      link: function(scope, elem) {
        var bodyEl = angular.element($window.document.body);
        var collectors = scope.collectors;

        scope.show = function() {
          scope.selectorOpen = true;
          scope.giveFocus = 1;;
          var currentValues = scope.model;
          _.forEach(collectors, function(c) {
            console.log("collector: "+c.name);
          });
          scope.options = _.map(collectors, function(c) {
            var option = {id: c.id, selected: false, name: c.name};
            if (_.indexOf(currentValues, c.id) >= 0) {
              option.selected = true;
            }
            return option;
          });

          $timeout(function() {
            bodyEl.on('click', scope.bodyOnClick);
          }, 0, false);
        };

        scope.optionSelected = function(option) {
          option.selected = !option.selected;

          if (option.name === 'All') {
            _.each(scope.options, function(other) {
              if (option !== other) {
                other.selected = false;
              }
            });
          }

          var selected = _.filter(scope.options, {selected: true});

          // enfore the first selected if no option is selected
          if (selected.length === 0) {
            scope.options[0].selected = true;
            selected = [scope.options[0]];
          }

          if (selected.length > 1) {
            if (selected[0].name === 'All') {
              selected[0].selected = false;
              selected = selected.slice(1, selected.length);
            }
          }
          scope.model = [];
          _.forEach(selected, function(c) {
            scope.model.push(c.id);
          })
        };

        scope.hide = function() {
          scope.selectorOpen = false;
          bodyEl.off('click', scope.bodyOnClick);
        };

        scope.bodyOnClick = function(e) {
          var dropdown = elem.find('.variable-value-dropdown');
          if (dropdown.has(e.target).length === 0) {
            scope.$apply(scope.hide);
          }
        };

      },
    };
  });

});
