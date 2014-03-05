define([
  'angular'
],
function (angular) {
  'use strict';

  angular
    .module('kibana.directives')
    .directive('ngBlur', ['$parse', function($parse) {
      return function(scope, element, attr) {
        var fn = $parse(attr['ngBlur']);
        element.bind('blur', function(event) {
          scope.$apply(function() {
            fn(scope, {$event:event});
          });
        });
      };
    }]);

  angular
    .module('kibana.directives')
    .directive('dynamicWidth', function() {
      return {
        restrict: 'A',
        link: function postLink(scope, elem, attrs) {
          var startVal = scope.$eval(attrs.ngModel);
          elem[0].style.width = ((startVal.length) * 11) + 'px';

          elem.keyup(function() {
            elem[0].style.width = ((elem.val().length * 11)) + 'px';
          });
        }
      };
    });


});