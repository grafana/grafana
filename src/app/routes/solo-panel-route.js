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

  module.controller('SoloPanelCtrl', function($scope, $rootScope, datasourceSrv, $routeParams, alertSrv, dashboardSrv, filterSrv) {

    var db = datasourceSrv.getGrafanaDB();

    db.getDashboard($routeParams.id, false)
      .then(function(dashboardData) {
        $scope.initPanelScope(dashboardData);
      }).then(null, function(error) {
        alertSrv.set('Error', error, 'error');
      });

    $scope.initPanelScope = function(dashboardData) {
      $scope.dashboard = dashboardSrv.create(dashboardData);
      $scope.grafana.style = $scope.dashboard.style;
      $scope.row = {
        height: '300px',
      };
      $scope.test = "Hej";
      $scope.$index = 0;
      $scope.panel = $scope.dashboard.rows[0].panels[0];
      $scope.panel.span = 12;

      $scope.filter = filterSrv;
      $scope.filter.init($scope.dashboard);
    };

  });

});
