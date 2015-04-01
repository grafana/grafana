define([
  'angular',
  'app',
  'lodash',
  'require',
  'components/panelmeta',
  './table',
  './pagingControl'
],
function (angular, app, _, require, PanelMeta) {
  'use strict';

  var module = angular.module('grafana.panels.table', []);
  app.useModule(module);

  module.directive('grafanaPanelTable', function() {
    return {
      controller: 'TablePanelCtrl',
      templateUrl: 'app/panels/table/module.html'
    };
  });

  module.controller('TablePanelCtrl', function($scope, templateSrv, $sce, panelSrv, panelHelper) {

    $scope.panelMeta = new PanelMeta({
      panelName: 'Table',
      editIcon:  "fa fa-table",
      fullscreen: true,
      metricsEditor: true
    });

    $scope.multipleQueriesNotSupported = true; // we can only do one query at a time, although it can be for multiple columns
    $scope.isTableView = true;

    $scope.panelMeta.addEditorTab('Display Styles', 'app/panels/table/styleEditor.html');
    $scope.panelMeta.addEditorTab('Time range', 'app/features/panel/partials/panelTime.html');
    $scope.panelMeta.addExtendedMenuItem('Export CSV', '', 'exportCsv()');

    // Set and populate defaults
    var _d = {
      title   : 'default title',
      datasource: null,
      content : "",
      style: {},
      timeFrom: null,
      timeShift: null,
      targets: [{ rawQuery: true }], // should only allow one query, set to raw query mode on page load
      columnWidth: 'auto',
      allowPaging: true,
      pageLimit: 20,
      allowSorting: true
    };

    $scope.permittedColumnWidthRange = _.range(40, 201);
    _.defaults($scope.panel, _d);

    $scope.init = function() {
      panelSrv.init($scope);
      $scope.ready = false;
      $scope.render();
    };

    $scope.refreshData = function(datasource) {
      panelHelper.updateTimeRange($scope);
      return panelHelper.issueMetricQuery($scope, datasource)
        .then($scope.dataHandler, function(err) {
          $scope.seriesList = [];
          $scope.render(null);
          throw err;
        });
    };

    $scope.dataHandler = function(results) {
      $scope.tableData = results.data[0]; // we are only allowing one query on the tableview series
      $scope.render();
    };

    $scope.render = function() {
      $scope.$broadcast('render', $scope.tableData);
    };

    $scope.shouldHidePaginationControl = function() {
      return $scope.dashboard.refresh || !$scope.panel.allowPaging;
    };

    $scope.init();
  });
});
