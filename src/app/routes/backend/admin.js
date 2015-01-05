define([
  'angular',
],
function (angular) {
  "use strict";

  var module = angular.module('grafana.routes');

  module.config(function($routeProvider) {
    $routeProvider
      .when('/admin/datasources', {
        templateUrl: 'app/features/admin/partials/datasources.html',
        controller : 'DataSourcesCtrl',
      })
      .when('/account', {
        templateUrl: 'app/features/admin/partials/account.html',
        controller : 'AccountCtrl',
      });
  });

});
