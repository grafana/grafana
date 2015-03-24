define([
  'angular',
  'app',
  'lodash',
  'require',
  'components/panelmeta',
],
function (angular, app, _, require, PanelMeta) {
  'use strict';

  var converter;

  var module = angular.module('grafana.panels.table', []);
  app.useModule(module);

  module.directive('grafanaPanelTable', function() {
    return {
      controller: 'TablePanelCtrl',
      templateUrl: 'app/panels/text/module.html',
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
      targets: [{ rawQuery: true }] // should only allow one query, set to raw query mode on page load
    };

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
          $scope.render([]);
          throw err;
        });
    };


    $scope.render = function() {
      $scope.renderText($scope.panel.content);
    };

    $scope.renderText = function(content) {
      content = content
        .replace(/&/g, '&amp;')
        .replace(/>/g, '&gt;')
        .replace(/</g, '&lt;')
        .replace(/\n/g, '<br/>');

      $scope.updateContent(content);
    };


    $scope.updateContent = function(html) {
      try {
        $scope.content = $sce.trustAsHtml(templateSrv.replace(html));
      } catch(e) {
        console.log('Text panel error: ', e);
        $scope.content = $sce.trustAsHtml(html);
      }

      if(!$scope.$$phase) {
        $scope.$digest();
      }
    };


    $scope.init();
  });
});
