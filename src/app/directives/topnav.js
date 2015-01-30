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
          section: "@",
          titleAction: "&",
          toggle: "&",
          showMenuBtn: "=",
        },
        template:
          '<div class="navbar navbar-static-top"><div class="navbar-inner"><div class="container-fluid">' +
          '<div class="top-nav">' +
            '<span class="top-nav-menu-btn" ng-if="showMenuBtn">' +
              '<a class="pointer" ng-click="toggle()">' +
                '<img class="logo-icon" src="img/fav32.png"></img>' +
                '<span>menu</span>' +
              '</a>' +
            '</span>' +

            '<span class="top-nav-breadcrumb">' +
              '<i class="top-nav-icon" ng-class="icon"></i>' +
              '<i class="fa fa-angle-right"></i>' +
            '</span>' +

           '<span class="top-nav-section" ng-show="section">' +
              '{{section}}' +
              '<i class="fa fa-angle-right"></i>' +
           '</span>' +

            '<a ng-click="titleAction()" class="top-nav-title">' +
              '{{title}}' +
              '<span class="small" ng-show="titleAction">' +
                '<i class="fa fa-angle-down"></i>' +
              '</span>' +
            '</a>' +
          '</div><div ng-transclude></div></div></div></div>',
        link: function(scope, elem, attrs) {
          scope.icon = attrs.icon;
        }
      };
    });

   angular
    .module('grafana.directives')
    .directive('topnavDash', function() {
      return {
        restrict: 'E',
        transclude: true,
        scope: {
          title: "@",
          section: "@",
          titleAction: "&",
          toggle: "&",
          showMenuBtn: "=",
        },
        template:
          '<div class="top-nav">' +
            '<span class="top-nav-menu-btn" ng-if="showMenuBtn">' +
              '<a class="pointer" ng-click="toggle()">' +
                '<img class="logo-icon" src="img/fav32.png"></img>' +
                '<span>menu</span>' +
              '</a>' +
            '</span>' +

            '<span class="top-nav-breadcrumb">' +
              '<i class="top-nav-icon" ng-class="icon"></i>' +
              '<i class="fa fa-angle-right"></i>' +
            '</span>' +

           '<span class="top-nav-section" ng-show="section">' +
              '{{section}}' +
              '<i class="fa fa-angle-right"></i>' +
           '</span>' +

            '<a ng-click="titleAction()" class="top-nav-title">' +
              '{{title}}' +
              '<span class="small" ng-show="titleAction">' +
                '<i class="fa fa-angle-down"></i>' +
              '</span>' +
            '</a>' +
          '</div>',
        link: function(scope, elem, attrs) {
          scope.icon = attrs.icon;
        }
      };
    });


});
