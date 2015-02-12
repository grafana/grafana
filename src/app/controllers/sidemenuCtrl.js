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

    $scope.menu = [];
    $scope.menu.push({
      text: "Dashboards",
      icon: "fa fa-th-large",
      href: $scope.getUrl("/"),
    });

    if (contextSrv.hasRole('Admin')) {
      $scope.menu.push({
        text: "Data Sources",
        icon: "fa fa-database",
        href: $scope.getUrl("/account/datasources"),
      });
      $scope.menu.push({
        text: "Account", href: $scope.getUrl("/account"),
        requireRole: "Admin",
        icon: "fa fa-shield",
      });
    }

    if (contextSrv.user.isGrafanaAdmin) {
      $scope.menu.push({
        text: "Admin", href: $scope.getUrl("/admin/users"),
        icon: "fa fa-cube",
        requireSignedIn: true,
      });
    }

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
