define([
  'angular',
  'lodash',
  'moment',
  'config',
  'store',
  'filesaver'
],
function (angular, _, moment) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('DashboardNavCtrl', function($scope, $rootScope, alertSrv, $location, playlistSrv, backendSrv, timeSrv) {

    $scope.init = function() {
      $scope.onAppEvent('save-dashboard', $scope.saveDashboard);
      $scope.onAppEvent('delete-dashboard', $scope.deleteDashboard);

      $scope.onAppEvent('zoom-out', function() {
        $scope.zoom(2);
      });
    };

    $scope.openEditView = function(editview) {
      var search = _.extend($location.search(), {editview: editview});
      $location.search(search);
    };

    $scope.starDashboard = function() {
      if ($scope.dashboardMeta.isStarred) {
        backendSrv.delete('/api/user/stars/dashboard/' + $scope.dashboard.id).then(function() {
          $scope.dashboardMeta.isStarred = false;
        });
      }
      else {
        backendSrv.post('/api/user/stars/dashboard/' + $scope.dashboard.id).then(function() {
          $scope.dashboardMeta.isStarred = true;
        });
      }
    };

    $scope.shareDashboard = function() {
      $scope.appEvent('show-modal', {
        src: './app/features/dashboard/partials/shareDashboard.html',
        scope: $scope.$new(),
      });
    };

    $scope.openSearch = function() {
      $scope.appEvent('show-dash-search');
    };

    $scope.dashboardTitleAction = function() {
      $scope.appEvent('hide-dash-editor');
      $scope.exitFullscreen();
    };

    $scope.saveDashboard = function(options) {
      var clone = angular.copy($scope.dashboard);

      backendSrv.saveDashboard(clone, options).then(function(data) {
        $scope.dashboard.version = data.version;
        $scope.appEvent('dashboard-saved', $scope.dashboard);

        var dashboardUrl = '/dashboard/db/' + data.slug;

        if (dashboardUrl !== $location.path()) {
          $location.url(dashboardUrl);
        }

        $scope.appEvent('alert-success', ['Dashboard saved', 'Saved as ' + clone.title]);
      }, $scope.handleSaveDashError);
    };

    $scope.handleSaveDashError = function(err) {
      if (err.data && err.data.status === "version-mismatch") {
        err.isHandled = true;

        $scope.appEvent('confirm-modal', {
          title: 'Someone else has updated this dashboard!',
          text: "Would you still like to save this dashboard?",
          yesText: "Save & Overwrite",
          icon: "fa-warning",
          onConfirm: function() {
            $scope.saveDashboard({overwrite: true});
          }
        });
      }

      if (err.data && err.data.status === "name-exists") {
        err.isHandled = true;

        $scope.appEvent('confirm-modal', {
          title: 'Another dashboard with the same name exists',
          text: "Would you still like to save this dashboard?",
          yesText: "Save & Overwrite",
          icon: "fa-warning",
          onConfirm: function() {
            $scope.saveDashboard({overwrite: true});
          }
        });
      }
    };

    $scope.deleteDashboard = function() {
      $scope.appEvent('confirm-modal', {
        title: 'Do you want to delete dashboard ' + $scope.dashboard.title + '?',
        icon: 'fa-trash',
        yesText: 'Delete',
        onConfirm: function() {
          $scope.deleteDashboardConfirmed();
        }
      });
    };

    $scope.deleteDashboardConfirmed = function() {
      backendSrv.delete('/api/dashboards/db/' + $scope.dashboardMeta.slug).then(function() {
        $scope.appEvent('alert-success', ['Dashboard Deleted', $scope.dashboard.title + ' has been deleted']);
        $location.url('/');
      });
    };

    $scope.saveDashboardAs = function() {
      var newScope = $rootScope.$new();
      newScope.clone = angular.copy($scope.dashboard);

      $scope.appEvent('show-modal', {
        src: './app/features/dashboard/partials/saveDashboardAs.html',
        scope: newScope,
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

    $scope.stopPlaylist = function() {
      playlistSrv.stop(1);
    };

  });

});
