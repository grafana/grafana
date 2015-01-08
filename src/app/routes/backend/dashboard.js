define([
  'angular',
  'store',
],
function (angular, store) {
  "use strict";

  var module = angular.module('grafana.routes');

  // remember previous dashboard
  var prevDashPath = null;

  module.controller('DashFromDBProvider', function(
        $scope, $rootScope, datasourceSrv, $routeParams,
        alertSrv, $http, $location) {

    var db = datasourceSrv.getGrafanaDB();
    var isTemp = window.location.href.indexOf('dashboard/temp') !== -1;

    if (!$routeParams.id) {
      // do we have a previous dash
      if (prevDashPath) {
        $location.path(prevDashPath);
      }

      var savedRoute = store.get('grafanaDashboardDefault');
      if (!savedRoute) {
        $http.get("app/dashboards/default.json?" + new Date().getTime()).then(function(result) {
          var dashboard = angular.fromJson(result.data);
          $scope.initDashboard(dashboard, $scope);
        },function() {
          $scope.initDashboard({}, $scope);
          $scope.appEvent('alert-error', ['Load dashboard failed', '']);
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
        prevDashPath = $location.path();
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
