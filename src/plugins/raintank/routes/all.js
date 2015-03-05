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
      .when('/network/locations', {
        templateUrl: 'plugins/raintank/features/admin/partials/locations.html',
        controller : 'LocationCtrl',
      })
      .when('/network/endpoints', {
        templateUrl: 'plugins/raintank/features/admin/partials/endpoints.html',
        controller : 'EndpointsCtrl',
      })
      .when('/network/monitors', {
        templateUrl: 'plugins/raintank/features/admin/partials/monitors.html',
        controller : 'MonitorCtrl',
      });
  });
});
 