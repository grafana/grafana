define([
  'angular',
  'store',
],
function (angular, store) {
  "use strict";

  var module = angular.module('grafana.routes');

  module.config(function($routeProvider) {
    $routeProvider
      .when('/', {
        templateUrl: '/app/partials/dashboard.html',
        controller : 'DashFromDBProvider',
        reloadOnSearch: false,
      })
      .when('/dashboard/db/:id', {
        templateUrl: '/app/partials/dashboard.html',
        controller : 'DashFromDBProvider',
        reloadOnSearch: false,
      })
      .when('/dashboard/temp/:id', {
        templateUrl: '/app/partials/dashboard.html',
        controller : 'DashFromDBProvider',
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
          $scope.emitAppEvent('setup-dashboard', dashboard);
        },function() {
          alertSrv.set('Error',"Could not load default dashboard", 'error');
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
        $scope.emitAppEvent('setup-dashboard', dashboard);
      }).then(null, function(error) {
        alertSrv.set('Error', error, 'error');
        $scope.emitAppEvent('setup-dashboard', {});
      });

  });

});
