define([
  'angular',
  'controllers/p_loginCtrl'
],
function (angular) {
  "use strict";

  var module = angular.module('grafana.routes');

  module.config(function($routeProvider) {
    $routeProvider
      .when('/', {
        templateUrl: '/app/partials/dashboard.html',
        controller : 'DashFromDBProvider',
      })
      .when('/dashboard/db/:id', {
        templateUrl: '/app/partials/dashboard.html',
        controller : 'DashFromDBProvider',
      })
      .when('/dashboard/temp/:id', {
        templateUrl: '/app/partials/dashboard.html',
        controller : 'DashFromDBProvider',
      })
      .when('/login', {
        templateUrl: '/app/partials/p_login.html',
        controller : 'LoginCtrl',
      });
  });

  module.controller('DashFromDBProvider', function($scope, $rootScope, datasourceSrv, $routeParams, alertSrv) {

    var db = datasourceSrv.getGrafanaDB();
    var isTemp = window.location.href.indexOf('dashboard/temp') !== -1;
    if (!$routeParams.id) {
      $routeParams.id = 'default';
    }

    db.getDashboard($routeParams.id, isTemp)
      .then(function(dashboard) {
        $scope.emitAppEvent('setup-dashboard', dashboard);
      }).then(null, function(error) {
        alertSrv.set('Error', error, 'error');
      });

  });

});
