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
      .when('/dashboard/import/:id', {
        templateUrl: 'app/partials/dashboard.html',
        controller : 'DashFromImportCtrl',
        reloadOnSearch: false,
      })
      .when('/dashboard/new', {
        templateUrl: 'app/partials/dashboard.html',
        controller : 'NewDashboardCtrl',
        reloadOnSearch: false,
      })
      .when('/dashboard/import', {
        templateUrl: 'app/features/dashboard/partials/import.html',
        controller : 'DashboardImportCtrl',
      })
      .when('/datasources', {
        templateUrl: 'app/features/org/partials/datasources.html',
        controller : 'DataSourcesCtrl',
      })
      .when('/datasources/edit/:id', {
        templateUrl: 'app/features/org/partials/datasourceEdit.html',
        controller : 'DataSourceEditCtrl',
      })
      .when('/datasources/new', {
        templateUrl: 'app/features/org/partials/datasourceEdit.html',
        controller : 'DataSourceEditCtrl',
      })
      .when('/org', {
        templateUrl: 'app/features/org/partials/orgDetails.html',
        controller : 'OrgDetailsCtrl',
      })
      .when('/org/users', {
        templateUrl: 'app/features/org/partials/orgUsers.html',
        controller : 'OrgUsersCtrl',
      })
      .when('/org/apikeys', {
        templateUrl: 'app/features/org/partials/orgApiKeys.html',
        controller : 'ApiKeysCtrl',
      })
      .when('/profile', {
        templateUrl: 'app/features/profile/partials/profile.html',
        controller : 'ProfileCtrl',
      })
      .when('/profile/password', {
        templateUrl: 'app/features/profile/partials/password.html',
        controller : 'ChangePasswordCtrl',
      })
      .when('/admin/settings', {
        templateUrl: 'app/features/admin/partials/settings.html',
        controller : 'AdminSettingsCtrl',
      })
      .when('/admin/users', {
        templateUrl: 'app/features/admin/partials/users.html',
        controller : 'AdminUsersCtrl',
      })
      .when('/admin/users/create', {
        templateUrl: 'app/features/admin/partials/new_user.html',
        controller : 'AdminEditUserCtrl',
      })
      .when('/admin/users/edit/:id', {
        templateUrl: 'app/features/admin/partials/edit_user.html',
        controller : 'AdminEditUserCtrl',
      })
      .when('/login', {
        templateUrl: 'app/partials/login.html',
        controller : 'LoginCtrl',
      })
      .when('/dashboard/solo/:id/', {
        templateUrl: 'app/features/panel/partials/soloPanel.html',
        controller : 'SoloPanelCtrl',
      })
      .otherwise({
        templateUrl: 'app/partials/error.html',
        controller: 'ErrorCtrl'
      });
  });

});
