define(['angular'],
function (angular) {
  'use strict';

  angular
    .module('grafana.directives')
    .directive('ngModelOnblur', function() {
      return {
        restrict: 'A',
        priority: 1,
        require: 'ngModel',
        link: function(scope, elm, attr, ngModelCtrl) {
          if (attr.type === 'radio' || attr.type === 'checkbox') {
            return;
          }

          elm.off('input keydown change');
          elm.bind('blur', function() {
            scope.$apply(function() {
              ngModelCtrl.$setViewValue(elm.val());
            });
          });
        }
      };
    })
    .directive('emptyToNull', function () {
      return {
        restrict: 'A',
        require: 'ngModel',
        link: function (scope, elm, attrs, ctrl) {
          ctrl.$parsers.push(function (viewValue) {
            if(viewValue === "") { return null; }
            return viewValue;
          });
        }
      };
    });
});
