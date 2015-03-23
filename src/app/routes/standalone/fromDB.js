define([
  'angular',
],
function (angular) {
  "use strict";

  var module = angular.module('grafana.routes');

  module.config(function($routeProvider) {
    $routeProvider
      .when('/dashboard/db/:id', {
        templateUrl: 'app/partials/dashboard.html',
        controller : 'DashFromDBProvider',
        reloadOnSearch: false,
      })
      .when('/dashboard/elasticsearch/:id', {
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

  module.controller('DashFromDBProvider', function($scope, $rootScope, datasourceSrv, $routeParams) {

    var db = datasourceSrv.getGrafanaDB();
    var isTemp = window.location.href.indexOf('dashboard/temp') !== -1;

    db.getDashboard($routeParams.id, isTemp)
    .then(function(dashboard) {
      $scope.initDashboard(dashboard, $scope);
    }).then(null, function(error) {
      $scope.initDashboard({ title: 'Grafana'}, $scope);
      $scope.appEvent('alert-error', ['Dashboard load failed', error]);
    });
  });

  module.controller('DashFromImportCtrl', function($scope, $location) {

    if (!window.grafanaImportDashboard) {
      $scope.appEvent('alert-warning', ['Dashboard load failed', 'Cannot reload unsaved imported dashboard']);
      $location.path('');
      return;
    }

    $scope.initDashboard(window.grafanaImportDashboard, $scope);
  });

});
