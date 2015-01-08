define([
  'angular',
  'app',
  'lodash'
],
function (angular) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('ErrorCtrl', function($scope) {

    var showSideMenu = $scope.grafana.sidemenu;
    $scope.grafana.sidemenu = false;

    $scope.$on('$destroy', function() {
      $scope.grafana.sidemenu = showSideMenu;
    });

  });

});
