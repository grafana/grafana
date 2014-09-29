define([
  'angular',
  'jquery',
  'config',
  'lodash',
  'services/all',
],
function (angular, $, config, _) {
  "use strict";

  var module = angular.module('grafana.controllers');

  module.controller('DashboardCtrl', function(
      $scope,
      $rootScope,
      dashboardKeybindings,
      timeSrv,
      templateValuesSrv,
      dashboardSrv,
      dashboardViewStateSrv,
      panelMoveSrv,
      $timeout) {

    $scope.editor = { index: 0 };
    $scope.panelNames = config.panels;
    var resizeEventTimeout;

    this.init = function(dashboardData) {
      $scope.availablePanels = config.panels;
      $scope.reset_row();
      $scope.registerWindowResizeEvent();
      $scope.onAppEvent('show-json-editor', $scope.showJsonEditor);
      $scope.setupDashboard(dashboardData);
    };

    $scope.registerWindowResizeEvent = function() {
      angular.element(window).bind('resize', function() {
        $timeout.cancel(resizeEventTimeout);
        resizeEventTimeout = $timeout(function() { $scope.$broadcast('render'); }, 200);
      });
    };

    $scope.setupDashboard = function(dashboardData) {
      $rootScope.performance.dashboardLoadStart = new Date().getTime();
      $rootScope.performance.panelsInitialized = 0;
      $rootScope.performance.panelsRendered = 0;

      $scope.dashboard = dashboardSrv.create(dashboardData);
      $scope.dashboardViewState = dashboardViewStateSrv.create($scope);

      // init services
      timeSrv.init($scope.dashboard);
      templateValuesSrv.init($scope.dashboard, $scope.dashboardViewState);
      panelMoveSrv.init($scope.dashboard, $scope);

      $scope.checkFeatureToggles();
      dashboardKeybindings.shortcuts($scope);

      $scope.setWindowTitleAndTheme();

      $scope.emitAppEvent("dashboard-loaded", $scope.dashboard);
    };

    $scope.setWindowTitleAndTheme = function() {
      window.document.title = config.window_title_prefix + $scope.dashboard.title;
      $scope.grafana.style = $scope.dashboard.style;
    };

    $scope.isPanel = function(obj) {
      if(!_.isNull(obj) && !_.isUndefined(obj) && !_.isUndefined(obj.type)) {
        return true;
      } else {
        return false;
      }
    };

    $scope.add_row = function(dash, row) {
      dash.rows.push(row);
    };

    $scope.add_row_default = function() {
      $scope.reset_row();
      $scope.row.title = 'New row';
      $scope.add_row($scope.dashboard, $scope.row);
    };

    $scope.reset_row = function() {
      $scope.row = {
        title: '',
        height: '250px',
        editable: true,
      };
    };

    $scope.edit_path = function(type) {
      var p = $scope.panel_path(type);
      if(p) {
        return p+'/editor.html';
      } else {
        return false;
      }
    };

    $scope.panel_path =function(type) {
      if(type) {
        return 'app/panels/'+type.replace(".","/");
      } else {
        return false;
      }
    };

    $scope.showJsonEditor = function(evt, options) {
      var editScope = $rootScope.$new();
      editScope.object = options.object;
      editScope.updateHandler = options.updateHandler;
      $scope.emitAppEvent('show-dash-editor', { src: 'app/partials/edit_json.html', scope: editScope });
    };

    $scope.checkFeatureToggles = function() {
      $scope.submenuEnabled = $scope.dashboard.templating.enable || $scope.dashboard.annotations.enable;
    };

    $scope.setEditorTabs = function(panelMeta) {
      $scope.editorTabs = ['General','Panel'];
      if(!_.isUndefined(panelMeta.editorTabs)) {
        $scope.editorTabs =  _.union($scope.editorTabs,_.pluck(panelMeta.editorTabs,'title'));
      }
      return $scope.editorTabs;
    };

  });
});
