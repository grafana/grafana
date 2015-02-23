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
      icon: "fa fa-fw fa-th-large",
      href: $scope.getUrl("/"),
    });

    if (contextSrv.hasRole('Admin')) {
      $scope.menu.push({
        text: "Data Sources",
        icon: "fa fa-fw fa-database",
        href: $scope.getUrl("/account/datasources"),
      });
      $scope.menu.push({
        text: "Organization", href: $scope.getUrl("/account"),
        icon: "fa fa-fw fa-users",
      });
    }

    $scope.updateState = function() {
    };

    $scope.init = function() {
      $scope.updateState();
    };
  });

});
