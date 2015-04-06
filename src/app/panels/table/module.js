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
  var timestampColumnName = 'Timestamp';

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
      targets: [{ rawQuery: false }],
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
      var columnOrder = _.pluck(results.data, 'target');

      if (columnOrder.length > 0) { // if data was returned, add timestamp column
        columnOrder.unshift(timestampColumnName);
      }

      var data = dataTransform(results.data);

      $scope.tableData = {
        values: data,
        columnOrder: columnOrder
      };

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

  /**
   * Transforms the raw datasource query return into an array of objects initially sorted by timestamp
   * @param results
   * @returns {Array}
   */
  function dataTransform(results) {
    // because we are performing multiple queries that may not have overlapping timestamps,
    // we must make sure we accumulate the total intersection first
    var timeStampColumnDict = {};
    var dataIndex = 0;
    var timestampIndex = 1;

    var columnNames = _.pluck(results, 'target');

    _.each(results, function(queryResult) {
      var curColumnName = queryResult.target;

      _.each(queryResult.datapoints, function(dataPoint) {
        var timestamp = dataPoint[timestampIndex];
        var value =  dataPoint[dataIndex];

        if (!timeStampColumnDict[timestamp]) {
          timeStampColumnDict[timestamp] = _.zipObject(columnNames);
          timeStampColumnDict[timestamp][timestampColumnName] = timestamp; // assign the timestamp value as well
        }

        timeStampColumnDict[timestamp][curColumnName] = value;
      });
    });

    // when accumulation is finished, we transform into an array
    var sortedTimestamps = _.
      chain(timeStampColumnDict)
      .keys()
      .sortBy()
      .value();

    var transformedResult = [];
    _.each(sortedTimestamps, function(sortedTimestamp) {
      transformedResult.push(timeStampColumnDict[sortedTimestamp]);
    });

    return transformedResult;
  }
});
