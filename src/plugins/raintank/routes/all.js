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
      .when('/locations', {
        templateUrl: 'plugins/raintank/features/partials/locations.html',
        controller : 'LocationCtrl',
      })
      .when('/locations/summary/:id', {
        templateUrl: 'plugins/raintank/features/partials/locations_summary.html',
        controller : 'LocationSummaryCtrl',
      })
      .when('/endpoints', {
        templateUrl: 'plugins/raintank/features/partials/endpoints.html',
        controller : 'EndpointsCtrl',
      })
      .when('/endpoints/new', {
        templateUrl: 'plugins/raintank/features/partials/endpoints_edit.html',
        controller : 'EndpointConfCtrl',
      })
      .when('/endpoints/view/:id', {
        templateUrl: 'plugins/raintank/features/partials/endpoints_view.html',
        controller : 'EndpointViewCtrl',
      })
      .when('/endpoints/edit/:id', {
        templateUrl: 'plugins/raintank/features/partials/endpoints_edit.html',
        controller : 'EndpointConfCtrl',
      })
  });
});
