define([
  'angular',
  'jquery',
  'bootstrap-tagsinput'
],
function (angular, $) {
  'use strict';

  angular
    .module('grafana.directives')
    .directive('bootstrapTagsinput', function() {

      function getItemProperty(scope, property) {
        if (!property) {
          return undefined;
        }

        if (angular.isFunction(scope.$parent[property])) {
          return scope.$parent[property];
        }

        return function(item) {
          return item[property];
        };
      }

      return {
        restrict: 'EA',
        scope: {
          model: '=ngModel'
        },
        template: '<select multiple></select>',
        replace: false,
        link: function(scope, element, attrs) {

          if (!angular.isArray(scope.model)) {
            scope.model = [];
          }

          var select = $('select', element);

          if (attrs.placeholder) {
            select.attr('placeholder', attrs.placeholder);
          }

          select.tagsinput({
            typeahead : {
              source   : angular.isFunction(scope.$parent[attrs.typeaheadSource]) ? scope.$parent[attrs.typeaheadSource] : null
            },
            itemValue: getItemProperty(scope, attrs.itemvalue),
            itemText : getItemProperty(scope, attrs.itemtext),
            tagClass : angular.isFunction(scope.$parent[attrs.tagclass]) ?
              scope.$parent[attrs.tagclass] : function() { return attrs.tagclass; }
          });

          select.on('itemAdded', function(event) {
            if (scope.model.indexOf(event.item) === -1) {
              scope.model.push(event.item);
            }
          });

          select.on('itemRemoved', function(event) {
            var idx = scope.model.indexOf(event.item);
            if (idx !== -1) {
              scope.model.splice(idx, 1);
            }
          });

          scope.$watch("model", function() {
            if (!angular.isArray(scope.model)) {
              scope.model = [];
            }

            select.tagsinput('removeAll');

            for (var i = 0; i < scope.model.length; i++) {
              select.tagsinput('add', scope.model[i]);
            }

          }, true);

        }
      };
    });

  angular
    .module('grafana.directives')
    .directive('gfDropdown', function ($parse, $compile, $timeout) {

      function buildTemplate(items, placement) {
        var upclass = placement === 'top' ? 'dropup' : '';
        var ul = [
          '<ul class="dropdown-menu ' + upclass + '" role="menu" aria-labelledby="drop1">',
          '</ul>'
        ];

        angular.forEach(items, function (item, index) {
          if (item.divider) {
            return ul.splice(index + 1, 0, '<li class="divider"></li>');
          }

          var li = '<li' + (item.submenu && item.submenu.length ? ' class="dropdown-submenu"' : '') + '>' +
            '<a tabindex="-1" ng-href="' + (item.href || '') + '"' + (item.click ? ' ng-click="' + item.click + '"' : '') +
              (item.target ? ' target="' + item.target + '"' : '') + (item.method ? ' data-method="' + item.method + '"' : '') +
              (item.configModal ? ' dash-editor-link="' + item.configModal + '"' : "") +
              '>' + (item.text || '') + '</a>';

          if (item.submenu && item.submenu.length) {
            li += buildTemplate(item.submenu).join('\n');
          }

          li += '</li>';
          ul.splice(index + 1, 0, li);
        });
        return ul;
      }

      return {
        restrict: 'EA',
        scope: true,
        link: function postLink(scope, iElement, iAttrs) {
          var getter = $parse(iAttrs.gfDropdown), items = getter(scope);
          $timeout(function () {
            var placement = iElement.data('placement');
            var dropdown = angular.element(buildTemplate(items, placement).join(''));
            dropdown.insertAfter(iElement);
            $compile(iElement.next('ul.dropdown-menu'))(scope);
          });

          iElement.addClass('dropdown-toggle').attr('data-toggle', 'dropdown');
        }
      };
    });
});
