define([
  'angular',
  'app',
  'lodash',
  'jquery',
],
function (angular, app, _, $) {
  'use strict';

  angular
    .module('grafana.directives')
    .directive('templateParamSelector', function($compile) {
      var inputTemplate = '<input type="text" data-provide="typeahead" ' +
                            ' class="tight-form-clear-input input-medium"' +
                            ' spellcheck="false" style="display:none"></input>';

      var buttonTemplate = '<a  class="tight-form-item tabindex="1">{{variable.current.text}} <i class="fa fa-caret-down"></i></a>';

      return {
        link: function($scope, elem) {
          var $input = $(inputTemplate);
          var $button = $(buttonTemplate);
          var variable = $scope.variable;

          $input.appendTo(elem);
          $button.appendTo(elem);

          function updateVariableValue(value) {
            $scope.$apply(function() {
              var selected = _.findWhere(variable.options, { text: value });
              if (!selected) {
                selected = { text: value, value: value };
              }
              $scope.setVariableValue($scope.variable, selected);
            });
          }

          $input.attr('data-provide', 'typeahead');
          $input.typeahead({
            minLength: 0,
            items: 1000,
            updater: function(value) {
              $input.val(value);
              $input.trigger('blur');
              return value;
            }
          });

          var typeahead = $input.data('typeahead');
          typeahead.lookup = function () {
            var options = _.map(variable.options, function(option) { return option.text; });
            this.query = this.$element.val() || '';
            return this.process(options);
          };

          $button.click(function() {
            $input.css('width', ($button.width() + 16) + 'px');

            $button.hide();
            $input.show();
            $input.focus();

            var typeahead = $input.data('typeahead');
            if (typeahead) {
              $input.val('');
              typeahead.lookup();
            }

          });

          $input.blur(function() {
            if ($input.val() !== '') { updateVariableValue($input.val()); }
            $input.hide();
            $button.show();
            $button.focus();
          });

          $scope.$on('$destroy', function() {
            $button.unbind();
            typeahead.destroy();
          });

          $compile(elem.contents())($scope);
        }
      };
    });

  angular
    .module('grafana.directives')
    .directive('variableValueSelect', function($compile, $window, $timeout) {
      return {
        scope: {
          variable: "=",
        },
        templateUrl: 'app/features/dashboard/partials/variableValueSelect.html',
        link: function(scope, elem) {
          var bodyEl = angular.element($window.document.body);

          scope.show = function() {
            scope.selectorOpen = true;
            scope.giveFocus = 1;

            $timeout(function() {
              bodyEl.on('click', scope.bodyOnClick);
            }, 0, false);
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

          scope.$on('$destroy', function() {
          });
        },
      };
    });

});
