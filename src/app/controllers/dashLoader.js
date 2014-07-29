define([
  'angular',
  'underscore',
  'moment',
  'filesaver'
],
function (angular, _, moment) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('dashLoader', function($scope, $rootScope, $http, alertSrv, $location, playlistSrv, elastic) {

    $scope.init = function() {
      $scope.onAppEvent('save-dashboard', function() {
        $scope.saveDashboard();
      });

      $scope.onAppEvent('zoom-out', function() {
        $scope.zoom(2);
      });

    };

    $scope.exitFullscreen = function() {
      $scope.emitAppEvent('panel-fullscreen-exit');
    };

    $scope.showDropdown = function(type) {
      if(_.isUndefined($scope.dashboard)) {
        return true;
      }

      var _l = $scope.dashboard.loader;
      if(type === 'load') {
        return (_l.load_elasticsearch);
      }
      if(type === 'save') {
        return (_l.save_elasticsearch);
      }
      return false;
    };

    $scope.set_default = function() {
      window.localStorage.grafanaDashboardDefault = $location.path();
      alertSrv.set('Home Set','This page has been set as your default dashboard','success',5000);
    };

    $scope.purge_default = function() {
      delete window.localStorage.grafanaDashboardDefault;
      alertSrv.set('Local Default Clear','Your default dashboard has been reset to the default','success', 5000);
    };

    $scope.saveForSharing = function() {
      elastic.saveForSharing($scope.dashboard)
        .then(function(result) {

          $scope.share = { url: result.url, title: result.title };

        }, function(err) {
          alertSrv.set('Save for sharing failed', err, 'error',5000);
        });
    };

    $scope.saveDashboard = function() {
      elastic.saveDashboard($scope.dashboard, $scope.dashboard.title)
        .then(function(result) {
          alertSrv.set('Dashboard Saved', 'Dashboard has been saved to Elasticsearch as "' + result.title + '"','success', 5000);

          $location.path(result.url);

          $rootScope.$emit('dashboard-saved', $scope.dashboard);

        }, function(err) {
          alertSrv.set('Save failed', err, 'error',5000);
        });
    };

    $scope.deleteDashboard = function(id) {
      if (!confirm('Are you sure you want to delete dashboard?')) {
        return;
      }

      elastic.deleteDashboard(id).then(function(id) {
        alertSrv.set('Dashboard Deleted', id + ' has been deleted', 'success', 5000);
      }, function() {
        alertSrv.set('Dashboard Not Deleted', 'An error occurred deleting the dashboard', 'error', 5000);
      });
    };

    $scope.exportDashboard = function() {
      var blob = new Blob([angular.toJson($scope.dashboard, true)], { type: "application/json;charset=utf-8" });
      window.saveAs(blob, $scope.dashboard.title + '-' + new Date().getTime());
    };

    // function $scope.zoom
    // factor :: Zoom factor, so 0.5 = cuts timespan in half, 2 doubles timespan
    $scope.zoom = function(factor) {
      var _range = $scope.filter.timeRange();
      var _timespan = (_range.to.valueOf() - _range.from.valueOf());
      var _center = _range.to.valueOf() - _timespan/2;

      var _to = (_center + (_timespan*factor)/2);
      var _from = (_center - (_timespan*factor)/2);

      // If we're not already looking into the future, don't.
      if(_to > Date.now() && _range.to < Date.now()) {
        var _offset = _to - Date.now();
        _from = _from - _offset;
        _to = Date.now();
      }

      $scope.filter.setTime({
        from:moment.utc(_from).toDate(),
        to:moment.utc(_to).toDate(),
      });
    };

    $scope.styleUpdated = function() {
      $scope.grafana.style = $scope.dashboard.style;
    };

    $scope.openSaveDropdown = function() {
      $scope.isFavorite = playlistSrv.isCurrentFavorite($scope.dashboard);
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
