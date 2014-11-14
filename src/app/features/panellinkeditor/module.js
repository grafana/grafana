define([
  'angular',
  'lodash',
  './linkSrv',
],
function (angular, _) {
  'use strict';

  angular
    .module('grafana.directives')
    .directive('panelLinkEditor', function() {
      return {
        scope: {
          panel: "="
        },
        restrict: 'E',
        controller: 'PanelLinkEditorCtrl',
        templateUrl: 'app/features/panellinkeditor/module.html',
        link: function() {
        }
      };
    }).controller('PanelLinkEditorCtrl', function($scope, datasourceSrv) {

      $scope.panel.links = $scope.panel.links || [];

      $scope.addLink = function() {
        $scope.panel.links.push({
          type: 'dashboard',
          name: 'Drilldown dashboard'
        });
      };

      $scope.searchDashboards = function(query, callback) {
        var ds = datasourceSrv.getGrafanaDB();
        if (ds === null) { return; }

        ds.searchDashboards(query).then(function(result) {
          var dashboards = _.map(result.dashboards, function(dash) {
            return dash.title;
          });

          callback(dashboards);
        });
      };

      $scope.deleteLink = function(link) {
        $scope.panel.links = _.without($scope.panel.links, link);
      };

    });
});
