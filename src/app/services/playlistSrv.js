define([
  'angular',
  'underscore',
  'kbn'
],
function (angular, _, kbn) {
  'use strict';

  var module = angular.module('kibana.services');

  module.service('playlistSrv', function(dashboard, $location, $rootScope) {

    this.markAsFavorite = function() {
      var favorites = this.getFavorites();

      var existing = _.findWhere(favorites.dashboards, { title: dashboard.current.title });

      if (existing) {
        favorites.dashboard = _.without(favorites.dashboards, existing);
      }

      favorites.dashboards.push({ url: $location.path(), title: dashboard.current.title });

      window.localStorage["grafana-favorites"] = angular.toJson(favorites);
    };

    this.getFavorites = function() {

      var favorites = { dashboards: [] };
      var existingJson = window.localStorage["grafana-favorites"];
      if (existingJson) {
        favorites = angular.fromJson(existingJson);
      }

      return favorites;
    };

    this.start = function(dashboards, timespan) {
      var interval = kbn.interval_to_ms(timespan);
      var index = 0;

      $rootScope.playlist_active = true;
      $rootScope.playlist_interval = interval;

      setInterval(function() {
        $rootScope.$apply(function() {
          $location.path(dashboards[index % dashboards.length].url);
          index++;
        });
      }, interval);
    };

  });

});