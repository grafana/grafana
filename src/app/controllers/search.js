define([
  'angular',
  'underscore',
  'config',
  'jquery'
],
function (angular, _, config, $) {
  'use strict';

  var module = angular.module('kibana.controllers');

  module.controller('SearchCtrl', function($scope, $rootScope, $element, $location, ejsResource, elasticClient) {

    $scope.init = function() {
      $scope.ejs = ejsResource(config.elasticsearch, config.elasticsearchBasicAuth);
      $scope.giveSearchFocus = 0;
      $scope.selectedIndex = -1;
      $scope.results = {dashboards: [], tags: [], metrics: []};
      $scope.query = { query: 'title:' };
      $scope.onAppEvent('open-search', $scope.openSearch, $scope);
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
          $location.path("/dashboard/elasticsearch/" + encodeURIComponent(selectedDash._id));
          setTimeout(function() {
            $('body').click(); // hack to force dropdown to close;
          });
        }
      }
    };

    $scope.searchDasboards = function(queryString) {
      var tagsOnly = queryString.indexOf('tags!:') === 0;
      if (tagsOnly) {
        var tagsQuery = queryString.substring(6, queryString.length);
        queryString = 'tags:' + tagsQuery + '*';
      }
      else {
        if (queryString.length === 0) {
          queryString = 'title:';
        }

        if (queryString[queryString.length - 1] !== '*') {
          queryString += '*';
        }
      }

      var query = {
        query: { query_string: { query: queryString } },
        facets: { tags: { terms: { field: "tags", order: "term", size: 50 } } },
        size: 20,
        sort: ["_uid"]
      };

      return elasticClient.post('dashboard/_search', query)
        .then(function(results) {
          if(_.isUndefined(results.hits)) {
            $scope.results.dashboards = [];
            $scope.results.tags = [];
            return;
          }

          $scope.tagsOnly = tagsOnly;
          $scope.results.dashboards = results.hits.hits;
          $scope.results.tags = results.facets.tags.terms;
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

      var queryStr = $scope.query.query.toLowerCase();

      if (queryStr.indexOf('m:') !== 0) {
        queryStr = queryStr.replace(' and ', ' AND ');
        $scope.searchDasboards(queryStr);
        return;
      }
    };

    $scope.openSearch = function (evt) {
      if (evt) {
        $element.find('.dropdown-toggle').dropdown('toggle');
      }

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