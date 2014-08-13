define([
  'angular',
  'lodash',
],
function (angular, _) {
  'use strict';

  var module = angular.module('grafana.services');

  module.factory('dashboardViewStateSrv', function($location, $route) {

    // represents the transient view state
    // like fullscreen panel & edit
    function DashboardViewState($scope) {
      var self = this;

      $scope.onAppEvent('$routeUpdate', function() {
        var current = $route.current.params;
        console.log('Route updated', current);
        if (self.fullscreen && !current.fullscreen) {
          console.log('emit panel exit');
          $scope.emitAppEvent('panel-fullscreen-exit');
        }
        if (!self.fullscreen && current.fullscreen) {
          $scope.emitAppEvent('dashboard-view-state-mismatch', current);
        }
      });

      this.panelScopes = [];

      var queryParams = $location.search();
      this.update({
        panelId: parseInt(queryParams.panelId),
        fullscreen: queryParams.fullscreen ? true : false,
        edit: queryParams.edit ? true : false
      });
    }

    DashboardViewState.prototype.update = function(state) {
      _.extend(this, state);
      if (!this.fullscreen) {
        delete this.fullscreen;
        delete this.panelId;
        delete this.edit;
      }
      if (!this.edit) { delete this.edit; }

      $location.search(this);
    };

    DashboardViewState.prototype.test = function() {

    };

    DashboardViewState.prototype.registerPanel = function(panelScope) {
      this.panelScopes.push(panelScope);
    };

    return {
      create: function($scope) {
        return new DashboardViewState($scope);
      }
    };

  });
});
