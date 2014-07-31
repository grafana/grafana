define([
  'angular',
  'underscore',
  'jquery',
  'config',
  'kbn',
  'moment'
],
function (angular, _, $, config, kbn, moment) {
  'use strict';

  var module = angular.module('grafana.services');

  module.factory('ElasticDatasource', function($q, $http) {

    function ElasticDatasource(datasource) {
      this.type = 'elastic';
      this.basicAuth = datasource.basicAuth;
      this.url = datasource.url;
      this.name = datasource.name;
      this.supportAnnotations = true;
      this.supportMetrics = false;
      this.index = datasource.index;
      this.grafanaDB = datasource.grafanaDB;
      this.annotationEditorSrc = 'app/partials/elasticsearch/annotation_editor.html';
    }

    ElasticDatasource.prototype._request = function(method, url, index, data) {
      var options = {
        url: this.url + "/" + index + url,
        method: method,
        data: data
      };

      if (this.basicAuth) {
        options.headers = {
          "Authorization": "Basic " + this.basicAuth
        };
      }

      return $http(options);
    };

    ElasticDatasource.prototype._get = function(url) {
      return this._request('GET', url, this.index)
        .then(function(results) {
          return results.data;
        });
    };

    ElasticDatasource.prototype._post = function(url, data) {
      return this._request('POST', url, this.index, data)
        .then(function(results) {
          return results.data;
        });
    };

    ElasticDatasource.prototype.annotationQuery = function(annotation, filterSrv, rangeUnparsed) {
      var range = {};
      var timeField = annotation.timeField || '@timestamp';
      var queryString = annotation.query || '*';
      var tagsField = annotation.tagsField || 'tags';
      var titleField = annotation.titleField || 'desc';
      var textField = annotation.textField || null;

      range[annotation.timeField]= {
        from: rangeUnparsed.from,
        to: rangeUnparsed.to,
      };

      var filter = { "bool": { "must": [{ "range": range }] } };
      var query = { "bool": { "should": [{ "query_string": { "query": queryString } }] } };
      var data = { "query" : { "filtered": { "query" : query, "filter": filter } }, "size": 100 };

      return this._request('POST', '/_search', annotation.index, data).then(function(results) {
        var list = [];
        var hits = results.data.hits.hits;

        for (var i = 0; i < hits.length; i++) {
          var source = hits[i]._source;
          var event = {
            annotation: annotation,
            time: moment.utc(source[timeField]).valueOf(),
            title: source[titleField],
          };

          if (source[tagsField]) {
            if (_.isArray(source[tagsField])) {
              event.tags = source[tagsField].join(', ');
            }
            else {
              event.tags = source[tagsField];
            }
          }
          if (textField && source[textField]) {
            event.text = source[textField];
          }

          list.push(event);
        }
        return list;
      });
    };

    ElasticDatasource.prototype.getDashboard = function(id) {
      var url = '/dashboard/' + id;

      // hack to check if it is a temp dashboard
      if (window.location.href.indexOf('dashboard/temp') > 0) {
        url = '/temp/' + id;
      }

      return this._get(url)
        .then(function(result) {
          if (result._source && result._source.dashboard) {
            return angular.fromJson(result._source.dashboard);
          } else {
            return false;
          }
        }, function(data) {
          if(data.status === 0) {
            throw "Could not contact Elasticsearch. Please ensure that Elasticsearch is reachable from your browser.";
          } else {
            throw "Could not find dashboard " + id;
          }
        });
    };

    ElasticDatasource.prototype.saveDashboard = function(dashboard, title) {
      var dashboardClone = angular.copy(dashboard);
      title = dashboardClone.title = title ? title : dashboard.title;

      var data = {
        user: 'guest',
        group: 'guest',
        title: title,
        tags: dashboardClone.tags,
        dashboard: angular.toJson(dashboardClone)
      };

      return this._request('PUT', '/dashboard/' + encodeURIComponent(title), this.index, data)
        .then(function() {
          return { title: title, url: '/dashboard/elasticsearch/' + title };
        }, function(err) {
          throw 'Failed to save to elasticsearch ' + err.data;
        });
    };

    ElasticDatasource.prototype.saveDashboardTemp = function(dashboard) {
      var data = {
        user: 'guest',
        group: 'guest',
        title: dashboard.title,
        tags: dashboard.tags,
        dashboard: angular.toJson(dashboard)
      };

      var ttl = dashboard.loader.save_temp_ttl;

      return this._request('POST', '/temp/?ttl=' + ttl, this.index, data)
        .then(function(result) {

          var baseUrl = window.location.href.replace(window.location.hash,'');
          var url = baseUrl + "#dashboard/temp/" + result.data._id;

          return { title: dashboard.title, url: url };

        }, function(err) {
          throw "Failed to save to temp dashboard to elasticsearch " + err.data;
        });
    };

    ElasticDatasource.prototype.deleteDashboard = function(id) {
      return this._request('DELETE', '/dashboard/' + id, this.index)
        .then(function(result) {
          return result.data._id;
        }, function(err) {
          throw err.data;
        });
    };

    ElasticDatasource.prototype.searchDashboards = function(queryString) {
      queryString = queryString.toLowerCase().replace(' and ', ' AND ');

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

      return this._post('/dashboard/_search', query)
        .then(function(results) {
          if(_.isUndefined(results.hits)) {
            return { dashboards: [], tags: [] };
          }

          return { dashboards: results.hits.hits, tags: results.facets.terms };
        });
    };

    return ElasticDatasource;

  });

});
