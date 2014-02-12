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

          for (var i = 0; i < scope.model.length; i++) {
            select.tagsinput('add', scope.model[i]);
          }

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

          // create a shallow copy of model's current state, needed to determine
          // diff when model changes
          var prev = scope.model.slice();
          scope.$watch("model", function() {

            var added = scope.model.filter(function(i) {return prev.indexOf(i) === -1;}),
                removed = prev.filter(function(i) {return scope.model.indexOf(i) === -1;}),
                i;

            prev = scope.model.slice();

            // Remove tags no longer in binded model
            for (i = 0; i < removed.length; i++) {
              select.tagsinput('remove', removed[i]);
            }

            // Refresh remaining tags
            select.tagsinput('refresh');

            // Add new items in model as tags
            for (i = 0; i < added.length; i++) {
              select.tagsinput('add', added[i]);
            }
          }, true);

        }
      };
    });
});