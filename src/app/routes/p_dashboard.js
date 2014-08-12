define([
  'angular',
],
function (angular) {
  "use strict";

  var module = angular.module('grafana.routes');

  module.config(function($routeProvider) {
    $routeProvider
      .when('/dashboard/db/:id', {
        templateUrl: '/app/partials/dashboard.html',
        controller : 'DashFromDBProvider',
      })
      .when('/dashboard/temp/:id', {
        templateUrl: '/app/partials/dashboard.html',
        controller : 'DashFromDBProvider',
      });
  });

  module.controller('DashFromDBProvider', function($scope, $rootScope, datasourceSrv, $routeParams, alertSrv) {

    var db = datasourceSrv.getGrafanaDB();
    var isTemp = window.location.href.indexOf('dashboard/temp') !== -1;

    db.getDashboard($routeParams.id, isTemp)
      .then(function(dashboard) {
        $scope.emitAppEvent('setup-dashboard', dashboard);
      }).then(null, function(error) {
        alertSrv.set('Error', error, 'error');
      });

  });

});
