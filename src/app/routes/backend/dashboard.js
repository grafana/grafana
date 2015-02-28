define([
  'angular',
  'store',
],
function (angular) {
  "use strict";

  var module = angular.module('grafana.routes');

  module.controller('DashFromDBProvider', function($scope, $routeParams, backendSrv) {

    if (!$routeParams.slug) {
      backendSrv.get('/api/dashboards/home').then(function(result) {
        $scope.initDashboard(result, $scope);
      },function() {
        $scope.initDashboard({}, $scope);
        $scope.appEvent('alert-error', ['Load dashboard failed', '']);
      });

      return;
    }

    return backendSrv.getDashboard($routeParams.slug).then(function(result) {
      $scope.initDashboard(result, $scope);
    }, function() {
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
