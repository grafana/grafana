define([
  'angular',
  'lodash',
  'moment',
  'config',
  'store',
  'filesaver'
],
function (angular, _, moment, config, store) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('DashboardNavCtrl', function($scope, $rootScope, alertSrv, $location, playlistSrv, datasourceSrv, timeSrv) {

    $scope.init = function() {
      $scope.db = datasourceSrv.getGrafanaDB();

      $scope.onAppEvent('save-dashboard', $scope.saveDashboard);
      $scope.onAppEvent('delete-dashboard', $scope.deleteDashboard);

      $scope.onAppEvent('zoom-out', function() {
        $scope.zoom(2);
      });

    };

    $scope.set_default = function() {
      store.set('grafanaDashboardDefault', $location.path());
      alertSrv.set('Home Set','This page has been set as your default dashboard','success',5000);
    };

    $scope.purge_default = function() {
      store.delete('grafanaDashboardDefault');
      alertSrv.set('Local Default Clear','Your default dashboard has been reset to the default','success', 5000);
    };

    $scope.saveForSharing = function() {
      var clone = angular.copy($scope.dashboard);
      clone.temp = true;
      $scope.db.saveDashboard(clone)
        .then(function(result) {

          $scope.share = { url: result.url, title: result.title };

        }, function(err) {
          alertSrv.set('Save for sharing failed', err, 'error',5000);
        });
    };

    $scope.passwordCache = function(pwd) {
      if (!window.sessionStorage) { return null; }
      if (!pwd) { return window.sessionStorage["grafanaAdminPassword"]; }
      window.sessionStorage["grafanaAdminPassword"] = pwd;
    };

    $scope.isAdmin = function() {
      if (!config.admin || !config.admin.password) { return true; }
      if ($scope.passwordCache() === config.admin.password) { return true; }

      var password = window.prompt("Admin password", "");
      $scope.passwordCache(password);

      if (password === config.admin.password) { return true; }

      alertSrv.set('Save failed', 'Password incorrect', 'error');

      return false;
    };

    $scope.openSearch = function() {
      $scope.emitAppEvent('show-dash-editor', { src: 'app/partials/search.html' });
    };

    $scope.saveDashboard = function() {
      if (!$scope.isAdmin()) { return false; }

      var clone = angular.copy($scope.dashboard);
      $scope.db.saveDashboard(clone)
        .then(function(result) {
          alertSrv.set('Dashboard Saved', 'Saved as "' + result.title + '"','success', 3000);

          if (result.url !== $location.path()) {
            $location.search({});
            $location.path(result.url);
          }

          $rootScope.$emit('dashboard-saved', $scope.dashboard);

        }, function(err) {
          alertSrv.set('Save failed', err, 'error', 5000);
        });
    };

    $scope.deleteDashboard = function(evt, options) {
      if (!confirm('Are you sure you want to delete dashboard?')) {
        return;
      }

      if (!$scope.isAdmin()) { return false; }

      var id = options.id;
      $scope.db.deleteDashboard(id).then(function(id) {
        alertSrv.set('Dashboard Deleted', id + ' has been deleted', 'success', 5000);
      }, function() {
        alertSrv.set('Dashboard Not Deleted', 'An error occurred deleting the dashboard', 'error', 5000);
      });
    };

    $scope.exportDashboard = function() {
      var blob = new Blob([angular.toJson($scope.dashboard, true)], { type: "application/json;charset=utf-8" });
      window.saveAs(blob, $scope.dashboard.title + '-' + new Date().getTime());
    };

    $scope.zoom = function(factor) {
      var range = timeSrv.timeRange();

      var timespan = (range.to.valueOf() - range.from.valueOf());
      var center = range.to.valueOf() - timespan/2;

      var to = (center + (timespan*factor)/2);
      var from = (center - (timespan*factor)/2);

      if(to > Date.now() && range.to <= Date.now()) {
        var offset = to - Date.now();
        from = from - offset;
        to = Date.now();
      }

      timeSrv.setTime({
        from: moment.utc(from).toDate(),
        to: moment.utc(to).toDate(),
      });
    };

    $scope.styleUpdated = function() {
      $scope.grafana.style = $scope.dashboard.style;
    };

    $scope.editJson = function() {
      $scope.emitAppEvent('show-json-editor', { object: $scope.dashboard });
    };

    $scope.openSaveDropdown = function() {
      $scope.isFavorite = playlistSrv.isCurrentFavorite($scope.dashboard);
      $scope.saveDropdownOpened = true;
    };

    $scope.markAsFavorite = function() {
      playlistSrv.markAsFavorite($scope.dashboard);
      $scope.isFavorite = true;
    };

    $scope.removeAsFavorite = function() {
      playlistSrv.removeAsFavorite($scope.dashboard);
      $scope.isFavorite = false;
    };

    $scope.stopPlaylist = function() {
      playlistSrv.stop(1);
    };

  });

});
