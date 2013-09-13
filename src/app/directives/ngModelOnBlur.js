define(['angular'],
function (angular) {
  'use strict';

  angular
    .module('kibana.directives')
    .directive('ngModelOnblur', function() {
      return {
        restrict: 'A',
        require: 'ngModel',
        link: function(scope, elm, attr, ngModelCtrl) {
          if (attr.type === 'radio' || attr.type === 'checkbox') {
            return;
          }

          elm.unbind('input').unbind('keydown').unbind('change');
          elm.bind('blur', function() {
            scope.$apply(function() {
              ngModelCtrl.$setViewValue(elm.val());
            });
          });
        }
      };
    });
});