define([
  'angular',
  'config'
],
function(angular, config) {
  "use strict";

  var module = angular.module('grafana.services');

  module.service('elastic', function($http, $q) {

    this._request = function(method, url, data) {
      var options = {
        url: config.elasticsearch + "/" + config.grafana_index + url,
        method: method,
        data: data
      };

      if (config.elasticsearchBasicAuth) {
        options.headers = {
          "Authorization": "Basic " + config.elasticsearchBasicAuth
        };
      }

      return $http(options);
    };

    this.get = function(url) {
      return this._request('GET', url)
        .then(function(results) {
          return results.data;
        });
    };

    this.post = function(url, data) {
      return this._request('POST', url, data)
        .then(function(results) {
          return results.data;
        });
    };

    this.deleteDashboard = function(id) {
      if (!this.isAdmin()) { return $q.reject("Invalid admin password"); }

      return this._request('DELETE', '/dashboard/' + id)
        .then(function(result) {
          return result.data._id;
        }, function(err) {
          throw err.data;
        });
    };

    this.saveForSharing = function(dashboard) {
      var data = {
        user: 'guest',
        group: 'guest',
        title: dashboard.title,
        tags: dashboard.tags,
        dashboard: angular.toJson(dashboard)
      };

      var ttl = dashboard.loader.save_temp_ttl;

      return this._request('POST', '/temp/?ttl=' + ttl, data)
        .then(function(result) {

          var baseUrl = window.location.href.replace(window.location.hash,'');
          var url = baseUrl + "#dashboard/temp/" + result.data._id;

          return { title: dashboard.title, url: url };

        }, function(err) {
          throw "Failed to save to temp dashboard to elasticsearch " + err.data;
        });
    };

    this.passwordCache = function(pwd) {
      if (!window.sessionStorage) { return null; }
      if (!pwd) { return window.sessionStorage["grafanaAdminPassword"]; }
      window.sessionStorage["grafanaAdminPassword"] = pwd;
    };

    this.isAdmin = function() {
      if (!config.admin || !config.admin.password) { return true; }
      if (this.passwordCache() === config.admin.password) { return true; }

      var password = window.prompt("Admin password", "");
      this.passwordCache(password);

      return password === config.admin.password;
    };

    this.saveDashboard = function(dashboard, title) {
      if (!this.isAdmin()) { return $q.reject("Invalid admin password"); }

      var dashboardClone = angular.copy(dashboard);
      title = dashboardClone.title = title ? title : dashboard.title;

      var data = {
        user: 'guest',
        group: 'guest',
        title: title,
        tags: dashboardClone.tags,
        dashboard: angular.toJson(dashboardClone)
      };

      return this._request('PUT', '/dashboard/' + encodeURIComponent(title), data)
        .then(function() {
          return { title: title, url: '/dashboard/elasticsearch/' + title };
        }, function(err) {
          throw 'Failed to save to elasticsearch ' + err.data;
        });
    };

  });
});
