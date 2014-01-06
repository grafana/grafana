define([
  'angular'
],
function (angular) {
  'use strict';

  angular.module('kibana.directives').directive('panelMenu', [
  '$parse',
  '$compile',
  '$timeout',
  function ($parse, $compile, $timeout) {
    var buildTemplate = function (items, ul) {
      if (!ul)
        ul = [
          '<ul class="dropdown-menu" role="menu" aria-labelledby="drop1">',
          '</ul>'
        ];
      angular.forEach(items, function (item, index) {
        if (item.divider)
          return ul.splice(index + 1, 0, '<li class="divider"></li>');
        var li = '<li' + (item.submenu && item.submenu.length ? ' class="dropdown-submenu"' : '') + '>' + '<a tabindex="-1" ng-href="' + (item.href || '') + '"' + (item.click ? '" ng-click="' + item.click + '"' : '') + (item.target ? '" target="' + item.target + '"' : '') + (item.method ? '" data-method="' + item.method + '"' : '') + '>' + (item.text || '') + '</a>';
        if (item.submenu && item.submenu.length)
          li += buildTemplate(item.submenu).join('\n');
        li += '</li>';
        ul.splice(index + 1, 0, li);
      });
      return ul;
    };
    return {
      restrict: 'EA',
      scope: true,
      link: function postLink(scope, iElement, iAttrs) {
        var getter = $parse(iAttrs.bsDropdown), items = getter(scope);
        $timeout(function () {
          if (!angular.isArray(items)) {
          }
          var dropdown = angular.element(buildTemplate(items).join(''));
          dropdown.insertAfter(iElement);
          $compile(iElement.next('ul.dropdown-menu'))(scope);
        });
        iElement.addClass('dropdown-toggle').attr('data-toggle', 'dropdown');
      }
    };
  }
]);

});