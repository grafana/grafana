define([
  'angular',
  'kbn'
],
function (angular) {
  'use strict';

  angular
    .module('grafana.directives')
    .directive('topnav', function() {
      return {
        restrict: 'E',
        transclude: true,
        scope: {
          title: "@",
          titleAction: "&",
          toggle: "&",
          showMenuBtn: "=",
        },
        template:
          '<div class="navbar navbar-static-top"><div class="navbar-inner"><div class="container-fluid">' +
          '<div class="top-nav">' +
            '<a class="top-nav-menu-btn pointer" ng-if="showMenuBtn" ng-click="toggle()">' +
              '<img class="logo-icon" src="img/fav32.png"></img> ' +
              '<i class="fa fa-bars"></i>' +
            '</a>' +

            '<span class="icon-circle top-nav-icon"">' +
              '<i ng-class="icon"></i>' +
            '</span>' +

            '<a ng-click="titleAction()" class="top-nav-title">' +
              '{{title}}' +
            '</a>' +
          '</div><div ng-transclude></div></div></div></div>',
        link: function(scope, elem, attrs) {
          scope.icon = attrs.icon;
        }
      };
    });

});
