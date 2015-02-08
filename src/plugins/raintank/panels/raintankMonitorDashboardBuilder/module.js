define([
  'angular',
  'app',
  'lodash',
  'kbn',
  'components/panelmeta',
],
function (angular, app, _, kbn, PanelMeta) {
  'use strict';

  var module = angular.module('grafana.panels.raintankMonitorDashboardBuilder', []);
  app.useModule(module);
    module.directive('grafanaPanelRaintankmonitordashboardbuilder', function() {
    return {
      controller: 'raintankMonitorDashboardBuilderCtrl',
      templateUrl: 'plugins/raintank/panels/raintankMonitorDashboardBuilder/module.html',
    };
  });
  module.controller('raintankMonitorDashboardBuilderCtrl', function($scope, $routeParams, panelSrv, backendSrv) {
    $scope.panelMeta = new PanelMeta({
      description : "Monitor Dashboard Builder",
      editIcon:  "fa fa-text-width",
      fullscreen: true,
    });
    $scope.panelMeta.addEditorTab('Options', 'plugins/raintank/panels/raintankMonitorDashboardBuilder/editor.html');

    // Set and populate defaults
    var _d = {
      monitor: null,
      refreshOnRender: false,
      refreshOnLoad: false,
      panelsLoaded: false,
    };

    _.defaults($scope.panel, _d);
    $scope.panel.monitor = $routeParams.monitor;
    $scope.init = function() {
      panelSrv.init(this);
      if ($scope.panel.refreshOnLoad) {
        $scope.panel.panelsLoaded = false;
      }
      $scope.$on('refresh', $scope.render);
      backendSrv.get('/api/locations').then(function(locations) {
        $scope.locations = locations;
        if ($scope.panel.monitor) {
          $scope.render();
        }
      });
    };

    $scope.render = function() {
      console.log($scope.panel);
      if ($scope.panel.refreshOnRender || ! $scope.panel.panelsLoaded) {
        backendSrv.get('/api/monitors/'+$scope.panel.monitor).then(function(monitor) {
          $scope.monitor = monitor;
          backendSrv.get('/api/monitor_types').then(function(types) {
            var found = false;
            _.forEach(types, function(type) {
              if (found) {
                return;
              }
              if (type.id == monitor.monitor_type_id) {
                $scope.monitor_type = type;
              }
            });
            console.log($scope.monitor_type);
            $scope.buildDashboard();
            $scope.panel.panelsLoaded=true;
          });
        });
      }
    };

    $scope.buildDashboard = function() {
      console.log('rebuilding dashboard');
      //remove dynamic rows from currently in the dashboard.
      for (var i=$scope.dashboard.rows.length -1 ; i>=0; i--) {
        console.log('checking row: '+ i);
        for (var j=$scope.dashboard.rows[i].panels.length -1; j>=0; j--) {
          if ('dynamic' in $scope.dashboard.rows[i].panels[j]) {
            $scope.dashboard.rows[i].panels.splice(j,1);
          }
        }
        //if the row is now empty, then remove it.
        if ($scope.dashboard.rows[i].panels.length == 0) {
          $scope.dashboard.rows.splice(i,1);
        }
      }
      $scope.dashboard.rows.push({
        "title": "Monitor Details",
        "height": "250px",
        "editable": true,
        "collapse": false,
        "panels": [{
            "id": 2,
            "dynamic": true,
            "title": "Monitor Details",
            "type": "raintankMonitorDescription",
            "span": 4,
            "editable": false,
            "monitor": $scope.panel.monitor,
          },
          /*{
            "id": 3,
            "dynamic": true,
            "title": "Monitor Events",
            "type": "raintankMonitorEventsPanel",
            "span": 8,
            "editable": true,
            "monitor": $scope.panel.monitor,
          },*/
        ],
      });
      $scope.dashboard.rows.push({
        "title": "Locations",
        "height": "250px",
        "editable": true,
        "collapse": false,
        "panels": [],
      });
      var rowId = $scope.dashboard.rows.length -1;
      var locationMap = {};
      _.forEach($scope.locations, function(l) {
        locationMap[l.id] = l;
      });
      _.forEach($scope.monitor.locations, function(lid) {
        var location = locationMap[lid];
        var panelStr = JSON.stringify($scope.monitor_type.panel_template);
        panelStr = panelStr.replace(/\%location\%/g, location.slug);
        panelStr = panelStr.replace(/\%monitor\%/g, $scope.monitor.slug);
        var panel = JSON.parse(panelStr);
        panel.dynamic = true;
        $scope.dashboard.add_panel(panel, $scope.dashboard.rows[rowId]);
      });  
    }

    $scope.panelRefresh = function() {
      $scope.panel.panelsLoaded = false;
      $scope.render();
    }

    $scope.openEditor = function() {
    };

    $scope.init();
  });
});
