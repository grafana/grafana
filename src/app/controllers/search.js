define([
  'angular',
  'underscore',
  'config',
  'jquery'
],
function (angular, _, config, $) {
  'use strict';

  var module = angular.module('kibana.controllers');

  module.controller('SearchCtrl', function($scope, $rootScope, dashboard, $element, $location) {

    $scope.init = function() {
      $scope.giveSearchFocus = 0;
      $scope.selectedIndex = -1;
      $scope.results = {dashboards: [], tags: [], metrics: []};
      $scope.query = { query: 'title:' };
      $rootScope.$on('open-search', $scope.openSearch);
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

    $scope.searchDasboards = function(query) {
      var request = $scope.ejs.Request().indices(config.grafana_index).types('dashboard');
      var tagsOnly = query.indexOf('tags!:') === 0;
      if (tagsOnly) {
        var tagsQuery = query.substring(6, query.length);
        query = 'tags:' + tagsQuery + '*';
      }
      else {
        if (query.length === 0) {
          query = 'title:';
        }

        if (query[query.length - 1] !== '*') {
          query += '*';
        }
      }

      return request
        .query($scope.ejs.QueryStringQuery(query))
        .sort('_uid')
        .facet($scope.ejs.TermsFacet("tags").field("tags").order('term').size(50))
        .size(20).doSearch()
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

      queryStr = queryStr.substring(2, queryStr.length);

      var words = queryStr.split(' ');
      var query = $scope.ejs.BoolQuery();
      var terms = _.map(words, function(word) {
        return $scope.ejs.MatchQuery('metricPath_ng', word).boost(1.2);
      });

      var ngramQuery = $scope.ejs.BoolQuery();
      ngramQuery.must(terms);

      var fieldMatchQuery = $scope.ejs.FieldQuery('metricPath', queryStr + "*").boost(1.2);
      query.should([ngramQuery, fieldMatchQuery]);

      var request = $scope.ejs.Request().indices(config.grafana_index).types('metricKey');
      var results = request.query(query).size(20).doSearch();

      results.then(function(results) {
        if (results && results.hits && results.hits.hits.length > 0) {
          $scope.results.metrics = { metrics: results.hits.hits };
        }
        else {
          $scope.results.metrics = { metric: [] };
        }
      });
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
      dashboard.current.rows.push({
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