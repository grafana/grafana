define([
  'angular',
  'config',
],
function (angular, config) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('SideMenuCtrl', function($scope) {

    $scope.menu = [
       {
         href: config.appSubUrl,
         text: 'Dashboards',
         icon: 'fa fa-th-large'
       },
       {
         href: 'panels',
         text: 'Panels',
         icon: 'fa fa-signal',
       },
       {
         href: 'alerts',
         text: 'Alerts',
         icon: 'fa fa-bolt',
       },
       {
         href: 'account',
         text: 'Account',
         icon: 'fa fa-user',
       },
    ];

    $scope.init = function() {
    };

  });

});
