define([
  'angular',
  'lodash',
  'config',
  'jquery'
],
function (angular, _, config, $) {
  'use strict';

  var module = angular.module('grafana.controllers');

  function djb2(str) {
    var hash = 5381;
    for (var i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash) + str.charCodeAt(i); /* hash * 33 + c */
    }
    return hash;
  }

  module.directive('tagColorFromName', function() {
    return function (scope, element) {
      var name = _.isString(scope.tag) ? scope.tag : scope.tag.term;
      var hash = djb2(name.toLowerCase());
      var r = (hash & 0xB00000) >> 16;
      var g = (hash & 0x00B000) >> 8;
      var b = hash & 0x0000B0;

      var color = "#" + ("0" + r.toString(16)).substr(-2) + ("0" + g.toString(16)).substr(-2) + ("0" + b.toString(16)).substr(-2);

      element.css("background-color", color);
    };
  });

  module.controller('SearchCtrl', function($scope, $rootScope, $element, $location, datasourceSrv) {

    $scope.init = function() {
      $scope.giveSearchFocus = 0;
      $scope.selectedIndex = -1;
      $scope.results = {dashboards: [], tags: [], metrics: []};
      $scope.query = { query: 'title:' };
      $scope.db = datasourceSrv.getGrafanaDB();
      $scope.onAppEvent('open-search', $scope.openSearch);
    };

    $scope.keyDown = function (evt) {
      if (evt.keyCode === 27) {
        $element.find('.dropdown-toggle').dropdown('toggle');
      }
      if (evt.keyCode === 40) {
        $scope.selectedIndex++;
      }
      if (evt.keyCode === 38) {
        $scope.selectedIndex--;
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
      return $scope.db.searchDashboards(queryString)
        .then(function(results) {
          $scope.tagsOnly = results.tagsOnly;
          $scope.results.dashboards = results.dashboards;
          $scope.results.tags = results.tags;
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

    $scope.showTags = function(evt) {
      evt.stopPropagation();
      $scope.tagsOnly = !$scope.tagsOnly;
      $scope.query.query = $scope.tagsOnly ? "tags!:" : "";
      $scope.giveSearchFocus = $scope.giveSearchFocus + 1;
      $scope.selectedIndex = -1;
      $scope.search();
    };

    $scope.search = function() {
      $scope.showImport = false;
      $scope.selectedIndex = -1;

      $scope.searchDashboards($scope.query.query);
    };

    $scope.openSearch = function (evt) {
      if (evt) {
        $element.next().find('.dropdown-toggle').dropdown('toggle');
      }

      $scope.searchOpened = true;
      $scope.giveSearchFocus = $scope.giveSearchFocus + 1;
      $scope.query.query = 'title:';
      $scope.search();
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

    $scope.toggleImport = function ($event) {
      $event.stopPropagation();
      $scope.showImport = !$scope.showImport;
    };

    $scope.newDashboard = function() {
      $location.url('/dashboard/file/empty.json');
    };

  });

  module.directive('xngFocus', function() {
    return function(scope, element, attrs) {
      $(element).click(function(e) {
        e.stopPropagation();
      });

      scope.$watch(attrs.xngFocus,function (newValue) {
        setTimeout(function() {
          newValue && element.focus();
        }, 200);
      },true);
    };
  });

});
