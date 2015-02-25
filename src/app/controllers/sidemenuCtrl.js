define([
  'angular',
  'lodash',
  'jquery',
  'config',
],
function (angular, _, $, config) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('SideMenuCtrl', function($scope, $location, contextSrv) {

    $scope.getUrl = function(url) {
      return config.appSubUrl + url;
    };

    $scope.setupMainNav = function() {
      $scope.mainLinks.push({
        text: "Dashboards",
        icon: "fa fa-fw fa-th-large",
        href: $scope.getUrl("/"),
      });

      if (contextSrv.hasRole('Admin')) {
        $scope.mainLinks.push({
          text: "Data Sources",
          icon: "fa fa-fw fa-database",
          href: $scope.getUrl("/datasources"),
        });
      }

      if (contextSrv.user.isSignedIn) {
        $scope.bottomLinks.push({
          text: contextSrv.user.name,
          imgSrc: contextSrv.user.gravatarUrl,
          href: $scope.getUrl("/profile"),
        });

        $scope.bottomLinks.push({
          text: contextSrv.user.orgName,
          href: $scope.getUrl("/org"),
          icon: "fa fa-fw fa-users",
        });

        if (contextSrv.hasRole('Admin')) {
          $scope.bottomLinks.push({
            text: "Grafana admin",
            icon: "fa fa-fw fa-cog",
            href: $scope.getUrl("/admin/settings"),
          });
        }

        $scope.bottomLinks.push({
          text: "Sign out",
          icon: "fa fa-fw fa-sign-out",
          href: $scope.getUrl("/logout"),
        });
      }
    };

    $scope.setupAdminNav = function() {
      $scope.systemSection = true;
      $scope.grafanaVersion = config.buildInfo.version;

      $scope.mainLinks.push({
        text: "System info",
        icon: "fa fa-fw fa-info",
        href: $scope.getUrl("/admin/settings"),
      });

      $scope.mainLinks.push({
        text: "Global Users",
        icon: "fa fa-fw fa-user",
        href: $scope.getUrl("/admin/users"),
      });

      $scope.mainLinks.push({
        text: "Global Orgs",
        icon: "fa fa-fw fa-users",
        href: $scope.getUrl("/admin/orgs"),
      });

      $scope.bottomLinks.push({
        text: "Exit admin",
        icon: "fa fa-fw fa-backward",
        href: $scope.getUrl("/"),
      });

      $scope.bottomLinks.push({
        text: "Sign out",
        icon: "fa fa-fw fa-sign-out",
        href: $scope.getUrl("/logout"),
      });
    };

    $scope.updateMenu = function() {
      $scope.systemSection = false;
      $scope.mainLinks = [];
      $scope.bottomLinks = [];

      var currentPath = $location.path();
      if (currentPath.indexOf('/admin') === 0) {
        $scope.setupAdminNav();
      } else {
        $scope.setupMainNav();
      }
    };

    $scope.init = function() {
      $scope.updateMenu();
      $scope.$on('$routeChangeSuccess', $scope.updateMenu);
    };
  });

});
