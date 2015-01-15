define([
  'angular',
  'jquery',
  'lodash',
  'config',
],
function (angular, jquery, _, config) {
  "use strict";

  var module = angular.module('grafana.routes');

  module.config(function($routeProvider) {
    $routeProvider
      .when('/dashboard/monitor/:id', {
        templateUrl: 'app/partials/dashboard.html',
        controller : 'DashFromMonitorProvider',
        reloadOnSearch: false,
      })
      .when('/dashboard/query/:id', {
        templateUrl: 'app/partials/dashboard.html',
        controller: 'DashFromQueryProvider',
      })
      .when('/location', {
        templateUrl: 'plugins/raintank/features/admin/partials/locations.html',
        controller : 'LocationCtrl',
      })
      .when('/monitor', {
        templateUrl: 'plugins/raintank/features/admin/partials/monitors.html',
        controller : 'MonitorCtrl',
      });
  });

  

  module.controller('DashFromQueryProvider', function($scope, $rootScope, $http, $routeParams, alertSrv, raintankContinuousQuery) {
    var dashTemplate = $http({
      url: "plugins/raintank/dashboards/empty.json",
      method: "GET",
    });
    var queryReq = raintankContinuousQuery.get($routeParams, function() {
      var query = queryReq.continuousQuery;
      dashTemplate.then(function(resp, status) {
        var dashboard = resp.data;
        dashboard.title = "Services";
        dashboard.rows = [{
          "title": "Query",
          "height": "250px",
          "editable": true,
          "collapse": false,
          "panels": [{
            "title": query.name,
            "type": "graph",
            "span": 8,
            "editable": true,
            "renderer": "flot",
            "x-axis": true,
            "y-axis": true,
            "scale": 1,
             "lines": true,
            "fill": 1,
            "linewidth": 1,
            "points": false,
            "pointradius": 5,
            "bars": false,
            "stack": false,
            "legend": {
              "show": true,
              "values": true,
              "min": true,
              "max": true,
              "current": true,
              "total": false,
              "avg": true
            },
            "targets": [
              {
                "target": query.destination,
              }
            ]
          }, {
            "title": "Events",
            "type": "raintankMetricEventsPanel",
            "span": 4,
            "metric": query.destination
          }]
        }];
        console.log(dashboard);
        $scope.initDashboard(dashboard, $scope);
      });
    });
  });
 

  module.controller('DashFromMonitorProvider', function($scope, $rootScope, $http, $routeParams, alertSrv, backendSrv) {
    var dashTemplate = $http({
      url: "plugins/raintank/dashboards/empty.json",
      method: "GET",
    });
    backendSrv.get('/api/monitors/'+$routeParams.id).then(function(monitor) {
      dashTemplate.then(function(resp, status) {
        var dashboard = resp.data;
        dashboard.title = "Monitor: " + monitor.name;
        dashboard.rows = [{
          "title": "Dashboard Builder",
          "height": "0px",
          "editable": true,
          "collapse": false,
          "panels": [{
            "title": "Monitor Dashboard Builder",
            "type": "raintankMonitorDashboardBuilder",
            "span": 12,
            "editable": true,
            "monitor": monitor.id,
          }]
        }];
        console.log(dashboard);
        $scope.initDashboard(dashboard, $scope);
      });
    });
  });
});
