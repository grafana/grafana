define([
  'angular',
  'app',
  'lodash'
],
function (angular) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('ErrorCtrl', function($scope, contextSrv) {

    var showSideMenu = contextSrv.sidemenu;
    contextSrv.sidemenu = false;

    $scope.$on('$destroy', function() {
      $scope.contextSrv.sidemenu = showSideMenu;
    });

  });

});
