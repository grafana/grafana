define([
  'angular',
],
function (angular) {
  "use strict";

  var module = angular.module('grafana.routes');

  module.config(function($routeProvider) {
    $routeProvider
      .when('/solo-panel/db/:id', {
        templateUrl: 'app/partials/solo-panel.html',
        controller : 'SoloPanelCtrl',
      });
  });

  module.controller('SoloPanelCtrl', function($scope, $rootScope, datasourceSrv, $routeParams, alertSrv, dashboard) {

    var db = datasourceSrv.getGrafanaDB();

    db.getDashboard($routeParams.id, false)
      .then(function(dashboard) {
        $scope.initPanelScope(dashboard);
      }).then(null, function(error) {
        alertSrv.set('Error', error, 'error');
      });
  });


  $scope.initPanelScope = function(dashboard){
    $scope.dashboard = dashboard.create(dashboardData);
    $scope.grafana.style = $scope.dashboard.style;

    $scope.filter = filterSrv;
    $scope.filter.init($scope.dashboard);


  };


});
