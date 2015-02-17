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

    $scope.openEditView = function(editview) {
      var search = _.extend($location.search(), {editview: editview});
      $location.search(search);
    };

    $scope.starDashboard = function() {
      if ($scope.dashboardMeta.isStarred) {
        $scope.db.unstarDashboard($scope.dashboard.id).then(function() {
          $scope.dashboardMeta.isStarred = false;
        });
      }
      else {
        $scope.db.starDashboard($scope.dashboard.id).then(function() {
          $scope.dashboardMeta.isStarred = true;
        });
      }
    };

    $scope.shareDashboard = function() {
      $scope.appEvent('show-modal', {
        src: './app/features/dashboard/partials/shareModal.html',
        scope: $scope.$new(),
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
      $scope.appEvent('show-dash-search');
    };

    $scope.saveDashboard = function() {
      if (!$scope.isAdmin()) { return false; }

      var clone = angular.copy($scope.dashboard);
      $scope.db.saveDashboard(clone)
        .then(function(result) {
          $scope.appEvent('alert-success', ['Dashboard saved', 'Saved as ' + result.title]);

          if (result.url !== $location.path()) {
            $location.search({});
            $location.path(result.url);
          }

          $rootScope.$emit('dashboard-saved', $scope.dashboard);

        }, function(err) {
          $scope.appEvent('alert-error', ['Save failed', err]);
        });
    };

    $scope.deleteDashboard = function() {
      if (!$scope.isAdmin()) { return false; }

      $scope.appEvent('confirm-modal', {
        title: 'Delete dashboard',
        text: 'Do you want to delete dashboard ' + $scope.dashboard.title + '?',
        onConfirm: function() {
          $scope.deleteDashboardConfirmed();
        }
      });
    };

    $scope.deleteDashboardConfirmed = function() {
      $scope.db.deleteDashboard($scope.dashboardMeta.slug).then(function() {
        $scope.appEvent('alert-success', ['Dashboard Deleted', $scope.dashboard.title + ' has been deleted']);
      }, function(err) {
        $scope.appEvent('alert-error', ['Deleted failed', err]);
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

    $scope.editJson = function() {
      $scope.appEvent('show-json-editor', { object: $scope.dashboard });
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
