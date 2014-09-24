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

  module.controller('DashFromDBProvider', function($scope, $rootScope, datasourceSrv, $routeParams, alertSrv) {

    var db = datasourceSrv.getGrafanaDB();
    var isTemp = window.location.href.indexOf('dashboard/temp') !== -1;

    db.getDashboard($routeParams.id, isTemp)
    .then(function(dashboard) {
      $scope.initDashboard(dashboard, $scope);
    }).then(null, function(error) {
      $scope.initDashboard({ title: 'Grafana'}, $scope);
      alertSrv.set('Error', error, 'error');
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
