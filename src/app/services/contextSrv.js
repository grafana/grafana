define([
  'angular',
  'lodash',
  'store',
],
function (angular, _, store) {
  'use strict';

  var module = angular.module('grafana.services');

  module.service('contextSrv', function(grafanaVersion, $rootScope, $timeout) {
    var self = this;

    function User() {
      if (window.grafanaBootData.user) {
        _.extend(this, window.grafanaBootData.user);
      }
    }

    this.version = grafanaVersion;
    this.lightTheme = false;
    this.user = new User();
    this.sidemenu = store.getBool('grafana.sidemenu');

    // events
    $rootScope.$on('toggle-sidemenu', function() {
      self.toggleSideMenu();
    });

    this.hasRole = function(role) {
      return this.user.orgRole === role;
    };

    this.setSideMenuState = function(state) {
      this.sidemenu = state;
      store.set('grafana.sidemenu', state);
    };

    this.toggleSideMenu = function() {
      this.setSideMenuState(!this.sidemenu);

      $timeout(function() {
        $rootScope.$broadcast("render");
      }, 50);
    };

  });

});
