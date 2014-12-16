define([
  'angular',
  'controllers/pro/accountCtrl',
  'controllers/pro/datasourcesCtrl',
],
function (angular) {
  "use strict";

  var module = angular.module('grafana.routes');

  module.config(function($routeProvider) {
    $routeProvider
      .when('/admin/datasources', {
        templateUrl: 'app/partials/pro/datasources.html',
        controller : 'DataSourcesCtrl',
      })
      .when('/account', {
        templateUrl: 'app/partials/pro/account.html',
        controller : 'AccountCtrl',
      });
  });

});
