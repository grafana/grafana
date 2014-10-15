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
    .directive('dropdownTypeahead', function($compile) {

      var inputTemplate = '<input type="text"'+
                            ' class="grafana-target-segment-input input-medium grafana-target-segment-input"' +
                            ' spellcheck="false" style="display:none"></input>';

      var buttonTemplate = '<a  class="grafana-target-segment grafana-target-function dropdown-toggle"' +
                              ' tabindex="1" gf-dropdown="menuItems" data-toggle="dropdown"' +
                              ' data-placement="top"><i class="icon-plus"></i></a>';

      return {
        scope: {
          "menuItems": "=dropdownTypeahead",
          "dropdownTypeaheadOnSelect": "&dropdownTypeaheadOnSelect"
        },
        link: function($scope, elem) {
          var $input = $(inputTemplate);
          var $button = $(buttonTemplate);
          $input.appendTo(elem);
          $button.appendTo(elem);

          var typeaheadValues = _.reduce($scope.menuItems, function(memo, value) {
            _.each(value.submenu, function(item) {
              memo.push(value.text + ' ' + item.text);
            });
            return memo;
          }, []);

          $input.attr('data-provide', 'typeahead');
          $input.typeahead({
            source: typeaheadValues,
            minLength: 1,
            items: 10,
            updater: function (value) {
              var result = {};
              _.each($scope.menuItems, function(menuItem, optionIndex) {
                _.each(menuItem.submenu, function(submenuItem, valueIndex) {
                  if (value === (menuItem.text + ' ' + submenuItem.text)) {
                    result.$item  = submenuItem;
                    result.$optionIndex = optionIndex;
                    result.$valueIndex = valueIndex;
                  }
                });
              });

              if (result.$item) {
                $scope.$apply(function() {
                  $scope.dropdownTypeaheadOnSelect(result);
                });
              }

              $input.trigger('blur');
              return '';
            }
          });

          $button.click(function() {
            $button.hide();
            $input.show();
            $input.focus();
          });

          $input.keyup(function() {
            elem.toggleClass('open', $input.val() === '');
          });

          $input.blur(function() {
            $input.hide();
            $input.val('');
            $button.show();
            $button.focus();
            // clicking the function dropdown menu wont
            // work if you remove class at once
            setTimeout(function() {
              elem.removeClass('open');
            }, 200);
          });

          $compile(elem.contents())($scope);
        }
      };
    });
});
