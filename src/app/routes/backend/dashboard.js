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
        return;
      }

      var savedRoute = store.get('grafanaDashboardDefault');
      if (!savedRoute) {
        $http.get("app/dashboards/default.json?" + new Date().getTime()).then(function(result) {
          var dashboard = angular.fromJson(result.data);
          $scope.initDashboard({model: dashboard, meta: {}}, $scope);
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

    db.getDashboard($routeParams.id, isTemp).then(function(result) {
      prevDashPath = $location.path();
      $scope.initDashboard(result, $scope);
    }).then(null, function() {
      $scope.initDashboard({
        meta: {},
        model: { title: 'Not found' }
      }, $scope);
    });
  });

  module.controller('DashFromImportCtrl', function($scope, $location, alertSrv) {
    if (!window.grafanaImportDashboard) {
      alertSrv.set('Not found', 'Cannot reload page with unsaved imported dashboard', 'warning', 7000);
      $location.path('');
      return;
    }
    $scope.initDashboard({ meta: {}, model: window.grafanaImportDashboard }, $scope);
  });

  module.controller('NewDashboardCtrl', function($scope) {
    $scope.initDashboard({
      meta: {},
      model: {
        title: "New dashboard",
        rows: [{ height: '250px', panels:[] }]
      },
    }, $scope);
  });

});
