define([
  'angular',
  'store',
],
function (angular, store) {
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
      });
  });

  module.controller('DashFromDBProvider', function(
        $scope, $rootScope, datasourceSrv, $routeParams,
        alertSrv, $http, $location) {

    var db = datasourceSrv.getGrafanaDB();
    var isTemp = window.location.href.indexOf('dashboard/temp') !== -1;

    if (!$routeParams.id) {
      var savedRoute = store.get('grafanaDashboardDefault');

      if (!savedRoute) {
        $http.get("app/dashboards/default.json?" + new Date().getTime()).then(function(result) {
          var dashboard = angular.fromJson(result.data);
          $scope.initDashboard(dashboard, $scope);
        },function(err) {
          $scope.initDashboard({}, $scope);
          $scope.appEvent('alert-error', ['Load dashboard failed', err]);
        });
        return;
      }
      else {
        $location.path(savedRoute);
        return;
      }
    }

    db.getDashboard($routeParams.id, isTemp)
      .then(function(dashboard) {
        $scope.initDashboard(dashboard, $scope);
      }).then(null, function(err) {
        $scope.appEvent('alert-error', ['Load dashboard failed', err]);
        $scope.initDashboard({}, $scope);
      });

  });

  module.controller('DashFromImportCtrl', function($scope, $location, alertSrv) {

    if (!window.grafanaImportDashboard) {
      alertSrv.set('Not found', 'Cannot reload page with unsaved imported dashboard', 'warning', 7000);
      $location.path('');
      return;
    }

    $scope.initDashboard(window.grafanaImportDashboard, $scope);
  });

});
