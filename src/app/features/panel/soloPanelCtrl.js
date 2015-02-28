define([
  'angular',
  'jquery',
],
function (angular, $) {
  "use strict";

  var module = angular.module('grafana.routes');

  module.controller('SoloPanelCtrl', function($scope, backendSrv, $routeParams, dashboardSrv, timeSrv, $location, templateValuesSrv) {
    var panelId;

    $scope.init = function() {
      var params = $location.search();
      panelId = parseInt(params.panelId);

      backendSrv.getDashboard($routeParams.slug)
        .then(function(dashboard) {
          $scope.initPanelScope(dashboard);
        }).then(null, function(error) {
          $scope.appEvent('alert-error', ['Load panel error', error]);
        });
    };

    $scope.initPanelScope = function(dashboard) {
      $scope.dashboard = dashboardSrv.create(dashboard.model);
      $scope.contextSrv.lightTheme = $scope.dashboard.style === 'light';

      $scope.row = {
        height: $(window).height() + 'px',
      };

      $scope.test = "Hej";
      $scope.$index = 0;
      $scope.panel = $scope.getPanelById(panelId);

      if (!$scope.panel) {
        $scope.appEvent('alert-error', ['Panel not found', '']);
        return;
      }

      $scope.panel.span = 12;
      $scope.dashboardViewState = { registerPanel: function() { }, state: {}};

      timeSrv.init($scope.dashboard);
      templateValuesSrv.init($scope.dashboard, $scope.dashboardViewState);
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

    if (!$scope.skipAutoInit) {
      $scope.init();
    }

  });

});
