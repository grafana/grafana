/*

  ## filtering

*/
define([
  'angular',
  'app',
  'underscore'
],
function (angular, app, _) {
  'use strict';

  var module = angular.module('kibana.panels.filtering', []);
  app.useModule(module);

  module.controller('filtering', function($scope, filterSrv, $rootScope, dashboard) {

    $scope.panelMeta = {
      status  : "Beta",
      description : "A controllable list of all filters currently applied to the dashboard. You "+
        "almost certainly want one of these on your dashboard somewhere."
    };

    // Set and populate defaults
    var _d = {
    };
    _.defaults($scope.panel,_d);

    $scope.init = function() {
      $scope.filterSrv = filterSrv;
    };

    $scope.remove = function(id) {
      filterSrv.remove(id);
      dashboard.refresh();
    };

    $scope.toggle = function(id) {
      filterSrv.list[id].active = !filterSrv.list[id].active;
      dashboard.refresh();
    };

    $scope.refresh = function() {
      $rootScope.$broadcast('refresh');
    };

    $scope.render = function() {
      $rootScope.$broadcast('render');
    };

    $scope.show_key = function(key) {
      return !_.contains(['type','id','alias','mandate','active','editing'],key);
    };

    $scope.isEditable = function(filter) {
      var uneditable = ['time'];
      if(_.contains(uneditable,filter.type)) {
        return false;
      } else {
        return true;
      }
    };

  });
});