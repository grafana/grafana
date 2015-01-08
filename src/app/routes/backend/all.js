define([
  'angular',
  './dashboard',
], function(angular) {
  "use strict";

  var module = angular.module('grafana.routes');

  module.config(function($routeProvider, $locationProvider) {
    $locationProvider.html5Mode(true);

    $routeProvider
      .when('/', {
        templateUrl: 'app/partials/dashboard.html',
        controller : 'DashFromDBProvider',
        reloadOnSearch: false,
      })
      .when('/dashboard/db/:id', {
        templateUrl: 'app/partials/dashboard.html',
        controller : 'DashFromDBProvider',
        reloadOnSearch: false,
      })
      .when('/dashboard/temp/:id', {
        templateUrl: 'app/partials/dashboard.html',
        controller : 'DashFromDBProvider',
        reloadOnSearch: false,
      })
      .when('/dashboard/import/:id', {
        templateUrl: 'app/partials/dashboard.html',
        controller : 'DashFromImportCtrl',
        reloadOnSearch: false,
      })
      .when('/admin/datasources', {
        templateUrl: 'app/features/admin/partials/datasources.html',
        controller : 'DataSourcesCtrl',
      })
      .when('/account', {
        templateUrl: 'app/features/admin/partials/account.html',
        controller : 'AccountCtrl',
      })
      .when('/login', {
        templateUrl: 'app/partials/login.html',
        controller : 'LoginCtrl',
      })
      .when('/register', {
        templateUrl: 'app/partials/register.html',
        controller : 'RegisterCtrl',
      })
      .when('/dashboard/solo/:id/', {
        templateUrl: 'app/partials/solo-panel.html',
        controller : 'SoloPanelCtrl',
      })
      .otherwise({
        templateUrl: 'app/partials/error.html',
      });
  });

});
