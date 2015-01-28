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
      text: "Dashbord",
      href: $scope.getUrl("/"),
      startsWith: config.appSubUrl + '/dashboard/',
      icon: "fa fa-th-large",
      links: [
        { text: 'Settings',    editview: 'settings'},
        { text: 'Templating',  editview: 'templating'},
        { text: 'Annotations', editview: 'annotations'},
        { text: 'Export', href:""},
        { text: 'JSON', href:""},
      ]
    });

    if ($scope.grafana.user.accountRole === 'Admin') {
      $scope.menu.push({
        text: "Account", href: $scope.getUrl("/account"),
        requireRole: "Admin",
        icon: "fa fa-shield",
        links: [
          { text: 'Info',         href: $scope.getUrl("/account")},
          { text: 'Data sources', href: $scope.getUrl("/account/datasources")},
          { text: 'Users',        href: $scope.getUrl("/account/users")},
          { text: 'API Keys',     href: $scope.getUrl("/account/apikeys")},
        ]
      });
    }

    if ($scope.grafana.user.isSignedIn) {
      $scope.menu.push({
        text: "Profile", href: $scope.getUrl("/profile"),
        icon: "fa fa-user",
        requireSignedIn: true,
        links: [
          { text: 'Info',     href: $scope.getUrl("/profile"), icon: "fa fa-sitemap" },
          { text: 'Password', href:"", icon: "fa fa-lock" },
        ]
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

    $scope.onAppEvent('$routeUpdate', function() {
      $scope.updateState();
    });

    $scope.onAppEvent('$routeChangeSuccess', function() {
      $scope.updateState();
    });

    $scope.updateState = function() {
      var currentPath = config.appSubUrl + $location.path();
      var search = $location.search();

      _.each($scope.menu, function(item) {
        item.active = false;

        if (item.href === currentPath) {
          item.active = true;
        }

        if (item.startsWith) {
          if (currentPath.indexOf(item.startsWith) === 0) {
            item.active = true;
            item.href = currentPath;
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
    };

    $scope.init = function() {
      $scope.updateState();
    };
  });

});
