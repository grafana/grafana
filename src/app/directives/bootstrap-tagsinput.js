define([
  'angular',
  'jquery',
  'bootstrap-tagsinput'
],
function (angular, $) {
  'use strict';

  angular
    .module('kibana.directives')
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
});