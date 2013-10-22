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

  module.controller('derivequeries', function($scope) {
    $scope.panelMeta = {
      status  : "Deprecated",
      description : "This panel has been replaced with the 'topN' mode in the query pull down."
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
    };
  });
});