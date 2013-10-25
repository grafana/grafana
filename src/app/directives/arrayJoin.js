define([
  'angular',
  'app',
  'underscore'
],
function (angular, app, _) {
  'use strict';

  angular
    .module('kibana.directives')
    .directive('arrayJoin', function() {
      return {
        restrict: 'A',
        require: 'ngModel',
        link: function(scope, element, attr, ngModel) {

          function split_array(text) {
            return (text || '').split(',');
          }

          function join_array(text) {
            if(_.isArray(text)) {
              return (text || '').join(',');
            } else {
              return text;
            }
          }

          ngModel.$parsers.push(split_array);
          ngModel.$formatters.push(join_array);
        }
      };
    });
});