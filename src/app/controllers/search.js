define([
  'angular',
  'underscore',
  'config',
  'jquery'
],
function (angular, _, config, $) {
  'use strict';

  var module = angular.module('kibana.controllers');

  module.controller('SearchCtrl', function($scope, dashboard) {

    $scope.init = function() {
      $scope.elasticsearch = $scope.elasticsearch || {};
      $scope.giveSearchFocus = 0;
      $scope.search_results = {
        dashboards: [],
        metrics: [],
        graphs: []
      };
    };

    $scope.elasticsearch_dblist = function(queryStr) {
      var words = queryStr.split(" ");
      var query = $scope.ejs.BoolQuery();
      var terms = _.map(words, function(word) {
        return $scope.ejs.MatchQuery("metricPath_ng", word).boost(1.2);
      });

      var ngramQuery = $scope.ejs.BoolQuery();
      ngramQuery.must(terms);

      var fieldMatchQuery = $scope.ejs.FieldQuery('metricPath', queryStr + "*").boost(1.2);
      query.should([ngramQuery, fieldMatchQuery]);

      var request = $scope.ejs.Request().indices(config.grafana_index).types('metricKey');
      var results = request.query(query).size(20).doSearch();

      results.then(function(results) {
        if (results && results.hits && results.hits.hits.length > 0) {
          $scope.search_results.metrics = results.hits.hits;
          console.log("hits", $scope.search_results.metrics);
        }
        else {
          $scope.search_results.metrics = [];
        }
      });
    };

    $scope.openSearch = function () {
      $scope.giveSearchFocus = $scope.giveSearchFocus + 1;
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