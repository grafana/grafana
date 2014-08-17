define([
  'angular',
  'lodash',
],
function (angular, _) {
  "use strict";

  var module = angular.module('grafana.routes');

  module.config(function($routeProvider) {
    $routeProvider
      .when('/dashboard/:id/panel/:panelId', {
        templateUrl: 'app/partials/pro/solo-panel.html',
        controller : 'SoloPanelCtrl',
      });
  });

  module.controller('SoloPanelCtrl', function($scope, $rootScope, datasourceSrv, $routeParams, alertSrv, dashboardSrv, filterSrv) {

    var db = datasourceSrv.getGrafanaDB();
    var panelId = parseInt($routeParams.panelId);

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
      $scope.panel = $scope.getPanelById(panelId);

      $scope.panel.span = 12;
      $scope.dashboardViewState = {
        registerPanel: function() {
        }
      };

      $scope.filter = filterSrv;
      $scope.filter.init($scope.dashboard);
    };

    $scope.getPanelById = function(id) {
      var rows = $scope.dashboard.rows;
      for (var i = 0; i < rows.length; i++) {
        var row = rows[i];
        for (var j = 0; j < row.panels.length; j++) {
          var panel = row.panels[j];
          if (panel.id === id) {
            return panel;
          }
        }
      }
      return null;
    };

  });

});
