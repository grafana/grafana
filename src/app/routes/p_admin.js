define([
  'angular',
  'controllers/pro/accountCtrl',
],
function (angular) {
  "use strict";

  var module = angular.module('grafana.routes');

  module.config(function($routeProvider) {
    $routeProvider
      .when('/admin/datasources', {
        templateUrl: 'app/partials/pro/admin_datasources.html',
        controller : 'AdminCtrl',
      })
      .when('/account', {
        templateUrl: 'app/partials/pro/account.html',
        controller : 'AccountCtrl',
      });
  });

});
