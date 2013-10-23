/*

  ## query

  ### Parameters
  * query ::  A string or an array of querys. String if multi is off, array if it is on
              This should be fixed, it should always be an array even if its only
              one element
*/
define([
  'angular',
  'app',
  'underscore',

  'css!./query.css'
], function (angular, app, _) {
  'use strict';

  var module = angular.module('kibana.panels.query', []);
  app.useModule(module);

  module.controller('query', function($scope, querySrv, $rootScope, dashboard, $q, $modal) {
    $scope.panelMeta = {
      status  : "Stable",
      description : "Manage all of the queries on the dashboard. You almost certainly need one of "+
        "these somewhere. This panel allows you to add, remove, label, pin and color queries"
    };

    // Set and populate defaults
    var _d = {
      query   : "*",
      pinned  : true,
      history : [],
      remember: 10 // max: 100, angular strap can't take a variable for items param
    };
    _.defaults($scope.panel,_d);

    $scope.querySrv = querySrv;

    // A list of query types for the query config popover
    $scope.queryTypes = _.map(querySrv.queryTypes, function(v,k) {
      return {
        name:k,
        require:v.require
      };
    });

    var queryHelpModal = $modal({
      template: './app/panels/query/helpModal.html',
      persist: true,
      show: false,
      scope: $scope,
    });

    $scope.init = function() {
    };

    $scope.refresh = function() {
      update_history(_.pluck($scope.querySrv.list,'query'));
      dashboard.refresh();
    };

    $scope.render = function() {
      $rootScope.$broadcast('render');
    };

    $scope.toggle_pin = function(id) {
      querySrv.list[id].pin = querySrv.list[id].pin ? false : true;
    };

    $scope.queryIcon = function(type) {
      return querySrv.queryTypes[type].icon;
    };

    $scope.queryConfig = function(type) {
      return "./app/panels/query/editors/"+(type||'lucene')+".html";
    };

    $scope.queryHelpPath = function(type) {
      return "./app/panels/query/help/"+(type||'lucene')+".html";
    };

    $scope.queryHelp = function(type) {
      $scope.help = {
        type: type
      };
      $q.when(queryHelpModal).then(function(modalEl) {
        modalEl.modal('show');
      });
    };

    $scope.typeChange = function(q) {
      var _nq = {
        id   : q.id,
        type : q.type,
        query: q.query,
        alias: q.alias,
        color: q.color
      };
      querySrv.list[_nq.id] = querySrv.defaults(_nq);
    };

    var update_history = function(query) {
      if($scope.panel.remember > 0) {
        $scope.panel.history = _.union(query.reverse(),$scope.panel.history);
        var _length = $scope.panel.history.length;
        if(_length > $scope.panel.remember) {
          $scope.panel.history = $scope.panel.history.slice(0,$scope.panel.remember);
        }
      }
    };

    $scope.init();

  });

});