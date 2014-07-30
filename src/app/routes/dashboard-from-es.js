define([
  'angular',
],
function (angular) {
  "use strict";

  var module = angular.module('grafana.routes');

  module.config(function($routeProvider) {
    $routeProvider
      .when('/dashboard/elasticsearch/:id', {
        templateUrl: 'app/partials/dashboard.html',
        controller : 'DashFromElasticProvider',
      })
      .when('/dashboard/temp/:id', {
        templateUrl: 'app/partials/dashboard.html',
        controller : 'DashFromElasticProvider',
      });
  });

  module.controller('DashFromElasticProvider', function($scope, $rootScope, datasourceSrv, $routeParams, alertSrv) {

    var db = datasourceSrv.getGrafanaDB();
    db.getDashboard($routeParams.id)
      .then(function(dashboard) {
        $scope.emitAppEvent('setup-dashboard', dashboard);
      }).then(null, function(error) {
        alertSrv.set('Error', error, 'error');
      });

  });

});
