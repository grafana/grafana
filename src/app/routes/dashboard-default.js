define([
  'angular',
  'config'
],
function (angular, config) {
  "use strict";

  var module = angular.module('kibana.routes');

  module.config(function($routeProvider) {
    $routeProvider
      .when('/', {
        redirectTo: function() {
          if (window.localStorage && window.localStorage.grafanaDashboardDefault) {
            return window.localStorage.grafanaDashboardDefault;
          }
          else {
            return config.default_route;
          }
        }
      });
  });

});
