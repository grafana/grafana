define([
  'angular',
  'config',
  'store',
  './fromDB',
  './fromFile',
  './fromScript',
],
function (angular, config, store) {
  'use strict';

  var module = angular.module('grafana.routes.standalone');

  module.config(function($routeProvider) {
    $routeProvider
      .otherwise({ redirectTo: config.default_route })
      .when('/', {
        redirectTo: function() {
          return store.get('grafanaDashboardDefault') || config.default_route;
        }
      });
  });

});
