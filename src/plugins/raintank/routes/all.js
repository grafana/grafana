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
      .when('/dashboard/monitor', {
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
 

  module.controller('DashFromMonitorProvider', function($scope, $rootScope, $http, alertSrv, backendSrv) {
    var dashTemplate = $http({
      url: "plugins/raintank/dashboards/empty.json",
      method: "GET",
    });
    dashTemplate.then(function(resp, status) {
      var dashboard = resp.data;
      dashboard.title = "Monitor Basic View";
      dashboard.rows = [{
        "title": "Monitor Dashboard Builder",
        "height": "0px",
        "editable": false,
        "collapse": false,
        "panels": [{
          "title": "Monitor Dashboard Builder",
          "type": "raintankMonitorDashboardBuilder",
          "span": 12,
          "editable": false,
        }]
      }];
      $scope.initDashboard({
        meta: {},
        model: dashboard
      }, $scope);
    });
  });
});
