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
      $scope.elasticsearch = $scope.elasticsearch || {};
      $scope.giveSearchFocus = 0;
      $scope.selectedIndex = -1;

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
        var selectedDash = $scope.search_results.dashboards[$scope.selectedIndex];
        if (selectedDash) {
          $location.path("/dashboard/elasticsearch/" + encodeURIComponent(selectedDash._id));
          setTimeout(function(){
            $('body').click(); // hack to force dropdown to close;
          });
        }
      }
    };

    $scope.elasticsearch_dashboards = function(query) {
      var request = $scope.ejs.Request().indices(config.grafana_index).types('dashboard');
      // if elasticsearch has disabled _all field we need
      // need to specifiy field here
      var q = 'title:' + (query + '*' || '*');

      return request.query($scope.ejs.QueryStringQuery(q)).size(50).doSearch()
        .then(function(results) {

          if(_.isUndefined(results.hits)) {
            $scope.search_results = { dashboards: [] };
            return;
          }

          var hits = _.sortBy(results.hits.hits, '_id');
          $scope.search_results = { dashboards: hits };
        });
    };

    $scope.elasticsearch_dblist = function(queryStr) {
      $scope.showImport = false;
      $scope.selectedIndex = -1;

      queryStr = queryStr.toLowerCase();

      if (queryStr.indexOf('m:') !== 0) {
        $scope.elasticsearch_dashboards(queryStr);
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
          $scope.search_results = { metrics: results.hits.hits };
        }
        else {
          $scope.search_results = { metric: [] };
        }
      });
    };

    $scope.openSearch = function (evt) {
      if (evt) {
        $element.find('.dropdown-toggle').dropdown('toggle');
      }

      $scope.giveSearchFocus = $scope.giveSearchFocus + 1;
      $scope.elasticsearch_dblist("");
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
            targets: [ { target: metricId } ]
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