define([
  'angular',
  'lodash',
  'jquery',
  'config',
],
function (angular, _, $, config) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('SideMenuCtrl', function($scope, $location) {

    $scope.getUrl = function(url) {
      return config.appSubUrl + url;
    };

    $scope.menu = [];
    $scope.menu.push({
      text: "Dashbords",
      icon: "fa fa-th-large",
      href: $scope.getUrl("/"),
      startsWith: config.appSubUrl + '/dashboard/',
    });

    $scope.menu.push({
      text: "Data Sources",
      icon: "fa fa-database",
      href: $scope.getUrl("/account/datasources"),
    });

    if ($scope.grafana.user.accountRole === 'Admin') {
      $scope.menu.push({
        text: "Account", href: $scope.getUrl("/account"),
        requireRole: "Admin",
        icon: "fa fa-shield",
      });
      $scope.menu.push({
        text: "Users", href: $scope.getUrl("/account/users"),
        requireRole: "Admin",
        icon: "fa fa-users",
      });
      $scope.menu.push({
        text: "API Keys", href: $scope.getUrl("/account/apikeys"),
        requireRole: "Admin",
        icon: "fa fa-key",
      });
    }

    if ($scope.grafana.user.isSignedIn) {
      $scope.menu.push({
        text: "Profile", href: $scope.getUrl("/profile"),
        icon: "fa fa-user",
      });
    }

    if ($scope.grafana.user.isGrafanaAdmin) {
      $scope.menu.push({
        text: "Admin", href: $scope.getUrl("/admin/users"),
        icon: "fa fa-cube",
        requireSignedIn: true,
        links: [
          { text: 'Settings', href: $scope.getUrl("/admin/settings")},
          { text: 'Users',    href: $scope.getUrl("/admin/users"), icon: "fa fa-lock" },
          { text: 'Log',      href: "", icon: "fa fa-lock" },
        ]
      });
    }

    if ($scope.grafana.user.isSignedIn) {
      $scope.menu.push({
        text: "Sign out", href: $scope.getUrl("/logout"),
        target: "_self",
        icon: "fa fa-sign-out",
      });
    }

    $scope.onAppEvent('$routeUpdate', function() {
      $scope.updateState();
    });

    $scope.onAppEvent('$routeChangeSuccess', function() {
      $scope.updateState();
    });

    $scope.updateState = function() {
      var currentPath = config.appSubUrl + $location.path();
      var search = $location.search();
      var activeIndex;

      _.each($scope.menu, function(item, index) {
        item.active = false;

        if (item.href === currentPath) {
          item.active = true;
          activeIndex = index;
        }

        if (item.startsWith) {
          if (currentPath.indexOf(item.startsWith) === 0) {
            item.active = true;
            item.href = currentPath;
            activeIndex = index;
          }
        }

        _.each(item.links, function(link) {
          link.active = false;

          if (link.editview) {
            var params = {};
            _.each(search, function(value, key) {
              if (value !== null) { params[key] = value; }
            });

            params.editview = link.editview;
            link.href = currentPath + '?' + $.param(params);
          }

          if (link.href === currentPath) {
            item.active = true;
            link.active = true;
          }
        });
      });

      //$scope.menu.splice(0, 0, $scope.menu.splice(activeIndex, 1)[0]);
    };

    $scope.init = function() {
      $scope.updateState();
    };
  });

});
