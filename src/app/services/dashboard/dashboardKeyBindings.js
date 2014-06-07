define([
  'angular',
  'jquery',
  'services/all'
],
function(angular, $) {
  "use strict";

  var module = angular.module('kibana.services.dashboard');

  module.service('dashboardKeybindings', function($rootScope, keyboardManager, dashboard) {
    this.shortcuts = function() {
      $rootScope.$on('panel-fullscreen-enter', function() {
        $rootScope.fullscreen = true;
      });

      $rootScope.$on('panel-fullscreen-exit', function() {
        $rootScope.fullscreen = false;
      });

      $rootScope.$on('dashboard-saved', function() {
        if ($rootScope.fullscreen) {
          $rootScope.$emit('panel-fullscreen-exit');
        }
      });

      keyboardManager.bind('ctrl+f', function(evt) {
        $rootScope.$emit('open-search', evt);
      }, { inputDisabled: true });

      keyboardManager.bind('ctrl+h', function() {
        var current = dashboard.current.hideControls;
        dashboard.current.hideControls = !current;
        dashboard.current.panel_hints = current;
      }, { inputDisabled: true });

      keyboardManager.bind('ctrl+s', function(evt) {
        $rootScope.$emit('save-dashboard', evt);
      }, { inputDisabled: true });

      keyboardManager.bind('ctrl+r', function() {
        dashboard.refresh();
      }, { inputDisabled: true });

      keyboardManager.bind('ctrl+z', function(evt) {
        $rootScope.$emit('zoom-out', evt);
      }, { inputDisabled: true });

      keyboardManager.bind('esc', function() {
        var popups = $('.popover.in');
        if (popups.length > 0) {
          return;
        }
        $rootScope.$emit('panel-fullscreen-exit');
      }, { inputDisabled: true });
    };
  });
});
