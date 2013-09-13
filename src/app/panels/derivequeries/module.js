/*
  ## Derivequeries

  ### Parameters
  * label :: The label to stick over the field
  * query :: A string to use as a filter for the terms facet
  * field :: the field to facet on
  * rest  :: include a filter that matches all other terms,
  * size :: how many queries to generate
  * fields :: a list of fields known to us
  * query_mode :: how to create query

*/
define([
  'angular',
  'app',
  'underscore'
],
function (angular, app, _) {
  'use strict';

  var module = angular.module('kibana.panels.derivequeries', []);
  app.useModule(module);

  module.controller('derivequeries', function($scope, $rootScope, querySrv, fields, dashboard, filterSrv) {
    $scope.panelMeta = {
      status  : "Experimental",
      description : "Creates a new set of queries using the Elasticsearch terms facet. For example,"+
       " you might want to create 5 queries showing the most frequent HTTP response codes. Be "+
       "careful not to select a high cardinality field, as Elasticsearch must load all unique values"+
       " into memory."
    };

    // Set and populate defaults
    var _d = {
      loading : false,
      label   : "Search",
      query   : "*",
      ids     : [],
      field   : '_type',
      fields  : [],
      spyable : true,
      rest    : false,
      size    : 5,
      mode    : 'terms only',
      exclude : [],
      history : [],
      remember: 10 // max: 100, angular strap can't take a variable for items param
    };
    _.defaults($scope.panel,_d);

    $scope.init = function() {
      $scope.editing = false;
      $scope.panel.fields = fields.list;
    };

    $scope.get_data = function() {
      update_history($scope.panel.query);

      // Make sure we have everything for the request to complete
      if(dashboard.indices.length === 0) {
        return;
      }

      $scope.panelMeta.loading = true;
      var request = $scope.ejs.Request().indices(dashboard.indices);

      // Terms mode
      request = request
        .facet($scope.ejs.TermsFacet('query')
          .field($scope.panel.field)
          .size($scope.panel.size)
          .exclude($scope.panel.exclude)
          .facetFilter($scope.ejs.QueryFilter(
            $scope.ejs.FilteredQuery(
              $scope.ejs.QueryStringQuery($scope.panel.query || '*'),
              filterSrv.getBoolFilter(filterSrv.ids)
              )))).size(0);

      $scope.populate_modal(request);

      var results = request.doSearch();

      // Populate scope when we have results
      results.then(function(results) {
        $scope.panelMeta.loading = false;
        var suffix;
        if ($scope.panel.query === '' || $scope.panel.mode === 'terms only') {
          suffix = '';
        } else if ($scope.panel.mode === 'AND') {
          suffix = ' AND (' + $scope.panel.query + ')';
        } else if ($scope.panel.mode === 'OR') {
          suffix = ' OR (' + $scope.panel.query + ')';
        }
        var ids = [];
        var terms = results.facets.query.terms;
        var others = [];
        _.each(terms, function(v) {
          var _q = $scope.panel.field+':"'+v.term+'"'+suffix;
          // if it isn't in the list, remove it
          var _iq = querySrv.findQuery(_q);
          if(!_iq) {
            ids.push(querySrv.set({alias: v.term, query:_q}));
          } else {
            ids.push(_iq.id);
          }
          others.push("NOT (" + _q + ")");
        });
        if ($scope.panel.rest) {
          var _other_q = others.join(' AND ');
          var _iq = querySrv.findQuery(_other_q);
          if (!_iq) {
            ids.push(querySrv.set({alias: 'other', query: _other_q}));
          } else {
            ids.push(_iq.id);
          }
        }
        _.each(_.difference($scope.panel.ids,ids),function(id){
          querySrv.remove(id);
        });
        $scope.panel.ids = ids;
        dashboard.refresh();
      });
    };

    $scope.set_refresh = function (state) {
      $scope.refresh = state;
    };

    $scope.close_edit = function() {
      if($scope.refresh) {
        $scope.get_data();
      }
      $scope.refresh =  false;
    };

    $scope.populate_modal = function(request) {
      $scope.inspector = angular.toJson(JSON.parse(request.toString()),true);
    };

    var update_history = function(query) {
      query = _.isArray(query) ? query : [query];
      if($scope.panel.remember > 0) {
        $scope.panel.history = _.union(query.reverse(),$scope.panel.history);
        var _length = $scope.panel.history.length;
        if(_length > $scope.panel.remember) {
          $scope.panel.history = $scope.panel.history.slice(0,$scope.panel.remember);
        }
      }
    };
  });
});