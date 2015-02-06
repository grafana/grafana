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
      .when('/location', {
        templateUrl: 'plugins/raintank/features/admin/partials/locations.html',
        controller : 'LocationCtrl',
      })
      .when('/monitor', {
        templateUrl: 'plugins/raintank/features/admin/partials/monitors.html',
        controller : 'MonitorCtrl',
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
        $scope.initDashboard({
          meta: {},
          model: dashboard
        }, $scope);
      });
    });
  });
});
