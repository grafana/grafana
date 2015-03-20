define([
  'angular',
  'lodash',
  'config',
],
function (angular, _, config) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('SearchCtrl', function($scope, $location, $timeout, backendSrv) {

    $scope.init = function() {
      $scope.giveSearchFocus = 0;
      $scope.selectedIndex = -1;
      $scope.results = {dashboards: [], tags: [], metrics: []};
      $scope.query = { query: '', tag: '', starred: false };
      $scope.currentSearchId = 0;

      $timeout(function() {
        $scope.giveSearchFocus = $scope.giveSearchFocus + 1;
        $scope.query.query = '';
        $scope.search();
      }, 100);

    };

    $scope.keyDown = function (evt) {
      if (evt.keyCode === 27) {
        $scope.dismiss();
      }
      if (evt.keyCode === 40) {
        $scope.moveSelection(1);
      }
      if (evt.keyCode === 38) {
        $scope.moveSelection(-1);
      }
      if (evt.keyCode === 13) {
        if ($scope.query.tagcloud) {
          var tag = $scope.results.tags[$scope.selectedIndex];
          if (tag) {
            $scope.filterByTag(tag.term);
          }
          return;
        }

        var selectedDash = $scope.results.dashboards[$scope.selectedIndex];
        if (selectedDash) {
          $location.search({});
          $location.path(selectedDash.url);
        }
      }
    };

    $scope.moveSelection = function(direction) {
      $scope.selectedIndex = Math.max(Math.min($scope.selectedIndex + direction, $scope.resultCount - 1), 0);
    };

    $scope.searchDashboards = function() {
      $scope.currentSearchId = $scope.currentSearchId + 1;
      var localSearchId = $scope.currentSearchId;

      return backendSrv.search($scope.query).then(function(results) {
        if (localSearchId < $scope.currentSearchId) { return; }

        $scope.resultCount = results.tagsOnly ? results.tags.length : results.dashboards.length;
        $scope.results.tags = results.tags;
        $scope.results.dashboards = _.map(results.dashboards, function(dash) {
          dash.url = 'dashboard/db/' + dash.slug;
          return dash;
        });

        if ($scope.queryHasNoFilters()) {
          $scope.results.dashboards.unshift({ title: 'Home', url: config.appSubUrl + '/', isHome: true });
        }
      });
    };

    $scope.queryHasNoFilters = function() {
      var query = $scope.query;
      return query.query === '' && query.starred === false && query.tag === '';
    };

    $scope.filterByTag = function(tag, evt) {
      $scope.query.tag = tag;
      $scope.query.tagcloud = false;
      $scope.search();
      $scope.giveSearchFocus = $scope.giveSearchFocus + 1;
      if (evt) {
        evt.stopPropagation();
        evt.preventDefault();
      }
    };

    $scope.showTags = function() {
      $scope.query.tagcloud = !$scope.query.tagcloud;
      $scope.giveSearchFocus = $scope.giveSearchFocus + 1;
      $scope.search();
    };

    $scope.showStarred = function() {
      $scope.query.starred = !$scope.query.starred;
      $scope.giveSearchFocus = $scope.giveSearchFocus + 1;
      $scope.search();
    };

    $scope.search = function() {
      $scope.showImport = false;
      $scope.selectedIndex = 0;
      $scope.searchDashboards();
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
      $location.url('dashboard/new');
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

    return {
      scope: { tag: "=" },
      link: function (scope, element) {
        var name = scope.tag;
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
      }
    };
  });
});
