define([
  'angular',
  'lodash',
],
function (angular, _) {
  'use strict';

  var module = angular.module('grafana.services');
  module.service('panelSrv', function($rootScope, $timeout, datasourceSrv) {

    this.init = function($scope) {
      if (!$scope.panel.span) { $scope.panel.span = 12; }
      if (!$scope.panel.title) { $scope.panel.title = 'No title'; }

      var menu = [
        {
          text: 'Edit',
          configModal: "app/partials/paneleditor.html",
          condition: !$scope.panelMeta.fullscreenEdit
        },
        {
          text: 'Edit',
          click: "toggleFullscreen(true)",
          condition: $scope.panelMeta.fullscreenEdit
        },
        {
          text: "Fullscreen",
          click: 'toggleFullscreen(false)',
          condition: $scope.panelMeta.fullscreenView
        },
        {
          text: 'Duplicate',
          click: 'duplicatePanel(panel)',
          condition: true
        },
        {
          text: 'Span',
          submenu: [
            { text: '1', click: 'updateColumnSpan(1)' },
            { text: '2', click: 'updateColumnSpan(2)' },
            { text: '3', click: 'updateColumnSpan(3)' },
            { text: '4', click: 'updateColumnSpan(4)' },
            { text: '5', click: 'updateColumnSpan(5)' },
            { text: '6', click: 'updateColumnSpan(6)' },
            { text: '7', click: 'updateColumnSpan(7)' },
            { text: '8', click: 'updateColumnSpan(8)' },
            { text: '9', click: 'updateColumnSpan(9)' },
            { text: '10', click: 'updateColumnSpan(10)' },
            { text: '11', click: 'updateColumnSpan(11)' },
            { text: '12', click: 'updateColumnSpan(12)' },
          ],
          condition: true
        },
        {
          text: 'Advanced',
          submenu: [
            { text: 'Panel JSON', click: 'editPanelJson()' },
          ],
          condition: true
        },
        {
          text: 'Remove',
          click: 'remove_panel_from_row(row, panel)',
          condition: true
        }
      ];

      $scope.inspector = {};
      $scope.panelMeta.menu = _.where(menu, { condition: true });

      $scope.editPanelJson = function() {
        $scope.emitAppEvent('show-json-editor', { object: $scope.panel, updateHandler: $scope.replacePanel });
      };

      $scope.updateColumnSpan = function(span) {
        $scope.panel.span = span;

        $timeout(function() {
          $scope.$emit('render');
        });
      };

      $scope.addDataQuery = function() {
        $scope.panel.targets.push({target: ''});
      };

      $scope.removeDataQuery = function (query) {
        $scope.panel.targets = _.without($scope.panel.targets, query);
        $scope.get_data();
      };

      $scope.setDatasource = function(datasource) {
        $scope.panel.datasource = datasource;
        $scope.datasource = datasourceSrv.get(datasource);

        if (!$scope.datasource) {
          $scope.panelMeta.error = "Cannot find datasource " + datasource;
          return;
        }
      };

      $scope.changeDatasource = function(datasource) {
        $scope.setDatasource(datasource);
        $scope.get_data();
      };

      $scope.toggleFullscreen = function(edit) {
        $scope.dashboardViewState.update({ fullscreen: true, edit: edit, panelId: $scope.panel.id });
      };

      $scope.otherPanelInFullscreenMode = function() {
        return $scope.dashboardViewState.fullscreen && !$scope.fullscreen;
      };

      // Post init phase
      $scope.fullscreen = false;
      $scope.editor = { index: 1 };
      if ($scope.panelMeta.fullEditorTabs) {
        $scope.editorTabs = _.pluck($scope.panelMeta.fullEditorTabs, 'title');
      }

      $scope.datasources = datasourceSrv.getMetricSources();
      $scope.setDatasource($scope.panel.datasource);
      $scope.dashboardViewState.registerPanel($scope);

      if ($scope.get_data) {
        var panel_get_data = $scope.get_data;
        $scope.get_data = function() {
          if ($scope.otherPanelInFullscreenMode()) { return; }

          delete $scope.panelMeta.error;
          $scope.panelMeta.loading = true;

          panel_get_data();
        };

        if (!$scope.skipDataOnInit) {
          $scope.get_data();
        }
      }
    };
  });

});
