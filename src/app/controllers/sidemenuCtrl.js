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

    $scope.mainLinks = [];
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

    $scope.bottomLinks = [];
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
          text: "System admin",
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

    $scope.updateState = function() {
    };

    $scope.init = function() {
      $scope.updateState();
    };
  });

});
