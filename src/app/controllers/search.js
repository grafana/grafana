define([
  'angular',
  'lodash',
  'config',
  'jquery'
],
function (angular, _, config, $) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('SearchCtrl', function($scope, $rootScope, $element, $location, datasourceSrv, $timeout) {

    $scope.init = function() {
      $scope.giveSearchFocus = 0;
      $scope.selectedIndex = -1;
      $scope.results = {dashboards: [], tags: [], metrics: []};
      $scope.query = { query: 'title:' };
      $scope.db = datasourceSrv.getGrafanaDB();
      $scope.currentSearchId = 0;

      $timeout(function() {
        $scope.giveSearchFocus = $scope.giveSearchFocus + 1;
        $scope.query.query = 'title:';
        $scope.search();
      }, 100);

    };

    $scope.keyDown = function (evt) {
      if (evt.keyCode === 27) {
        $scope.emitAppEvent('hide-dash-editor');
      }
      if (evt.keyCode === 40) {
        $scope.moveSelection(1);
      }
      if (evt.keyCode === 38) {
        $scope.moveSelection(-1);
      }
      if (evt.keyCode === 13) {
        if ($scope.tagsOnly) {
          var tag = $scope.results.tags[$scope.selectedIndex];
          if (tag) {
            $scope.filterByTag(tag.term);
          }
          return;
        }

        var selectedDash = $scope.results.dashboards[$scope.selectedIndex];
        if (selectedDash) {
          $location.search({});
          $location.path("/dashboard/db/" + selectedDash.id);
          setTimeout(function() {
            $('body').click(); // hack to force dropdown to close;
          });
        }
      }
    };

    $scope.moveSelection = function(direction) {
      $scope.selectedIndex = Math.max(Math.min($scope.selectedIndex + direction, $scope.resultCount - 1), 0);
    };

    $scope.goToDashboard = function(id) {
      $location.path("/dashboard/db/" + id);
    };

    $scope.shareDashboard = function(title, id, $event) {
      $event.stopPropagation();
      var baseUrl = window.location.href.replace(window.location.hash,'');

      $scope.share = {
        title: title,
        url: baseUrl + '#dashboard/db/' + encodeURIComponent(id)
      };
    };

    $scope.searchDashboards = function(queryString) {
      // bookeeping for determining stale search requests
      var searchId = $scope.currentSearchId + 1;
      $scope.currentSearchId = searchId > $scope.currentSearchId ? searchId : $scope.currentSearchId;

      return $scope.db.searchDashboards(queryString)
        .then(function(results) {
          // since searches are async, it's possible that these results are not for the latest search. throw
          // them away if so
          if (searchId < $scope.currentSearchId) {
            return;
          }

          $scope.tagsOnly = results.tagsOnly;
          $scope.results.dashboards = results.dashboards;
          $scope.results.tags = results.tags;
          $scope.resultCount = results.tagsOnly ? results.tags.length : results.dashboards.length;
        });
    };

    $scope.filterByTag = function(tag, evt) {
      $scope.query.query = "tags:" + tag + " AND title:";
      $scope.search();
      $scope.giveSearchFocus = $scope.giveSearchFocus + 1;
      if (evt) {
        evt.stopPropagation();
        evt.preventDefault();
      }
    };

    $scope.showTags = function() {
      $scope.tagsOnly = !$scope.tagsOnly;
      $scope.query.query = $scope.tagsOnly ? "tags!:" : "";
      $scope.giveSearchFocus = $scope.giveSearchFocus + 1;
      $scope.selectedIndex = -1;
      $scope.search();
    };

    $scope.search = function() {
      $scope.showImport = false;
      $scope.selectedIndex = 0;
      $scope.searchDashboards($scope.query.query);
    };

    $scope.deleteDashboard = function(dash, evt) {
      evt.stopPropagation();
      $scope.emitAppEvent('delete-dashboard', { id: dash.id });
      $scope.results.dashboards = _.without($scope.results.dashboards, dash);
    };

    $scope.addMetricToCurrentDashboard = function (metricId) {
      $scope.dashboard.rows.push({
        title: '',
        height: '250px',
        editable: true,
        panels: [
          {
            type: 'graphite',
            title: 'test',
            span: 12,
            targets: [{ target: metricId }]
          }
        ]
      });
    };

    $scope.toggleImport = function () {
      $scope.showImport = !$scope.showImport;
    };

    $scope.newDashboard = function() {
      $location.url('/dashboard/file/empty.json');
    };

  });

  module.directive('xngFocus', function() {
    return function(scope, element, attrs) {
      element.click(function(e) {
        e.stopPropagation();
      });

      scope.$watch(attrs.xngFocus,function (newValue) {
        if (!newValue) {
          return;
        }
        setTimeout(function() {
          element.focus();
          var pos = element.val().length * 2;
          element[0].setSelectionRange(pos, pos);
        }, 200);
      },true);
    };
  });

  module.directive('tagColorFromName', function() {

    function djb2(str) {
      var hash = 5381;
      for (var i = 0; i < str.length; i++) {
        hash = ((hash << 5) + hash) + str.charCodeAt(i); /* hash * 33 + c */
      }
      return hash;
    }

    return function (scope, element) {
      var name = _.isString(scope.tag) ? scope.tag : scope.tag.term;
      var hash = djb2(name.toLowerCase());
      var colors = [
        "#E24D42","#1F78C1","#BA43A9","#705DA0","#466803",
        "#508642","#447EBC","#C15C17","#890F02","#757575",
        "#0A437C","#6D1F62","#584477","#629E51","#2F4F4F",
        "#BF1B00","#806EB7","#8a2eb8", "#699e00","#000000",
        "#3F6833","#2F575E","#99440A","#E0752D","#0E4AB4",
        "#58140C","#052B51","#511749","#3F2B5B",
      ];
      var color = colors[Math.abs(hash % colors.length)];
      element.css("background-color", color);
    };

  });

});
