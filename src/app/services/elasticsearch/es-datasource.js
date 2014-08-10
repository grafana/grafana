define([
  'angular',
  'lodash',
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
      this.index = datasource.index;
      this.grafanaDB = datasource.grafanaDB;
      this.searchMaxResults = config.search.max_results || 20;

      this.saveTemp = _.isUndefined(datasource.save_temp) ? true : datasource.save_temp;
      this.saveTempTTL = _.isUndefined(datasource.save_temp_ttl) ? '30d' : datasource.save_temp_ttl;

      this.annotationEditorSrc = 'app/partials/elasticsearch/annotation_editor.html';
      this.supportAnnotations = true;
      this.supportMetrics = false;
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

      var queryInterpolated = filterSrv.applyTemplateToTarget(queryString);
      var filter = { "bool": { "must": [{ "range": range }] } };
      var query = { "bool": { "should": [{ "query_string": { "query": queryInterpolated } }] } };
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

    ElasticDatasource.prototype.getDashboard = function(id, isTemp) {
      var url = '/dashboard/' + id;

      if (isTemp) {
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

    ElasticDatasource.prototype.saveDashboard = function(dashboard) {
      var title = dashboard.title;
      var temp = dashboard.temp;
      if (temp) { delete dashboard.temp; }

      var data = {
        user: 'guest',
        group: 'guest',
        title: title,
        tags: dashboard.tags,
        dashboard: angular.toJson(dashboard)
      };

      if (temp) {
        return this._saveTempDashboard(data);
      }
      else {
        return this._request('PUT', '/dashboard/' + encodeURIComponent(title), this.index, data)
          .then(function() {
            return { title: title, url: '/dashboard/db/' + title };
          }, function(err) {
            throw 'Failed to save to elasticsearch ' + err.data;
          });
      }
    };

    ElasticDatasource.prototype._saveTempDashboard = function(data) {
      return this._request('POST', '/temp/?ttl=' + this.saveTempTTL, this.index, data)
        .then(function(result) {

          var baseUrl = window.location.href.replace(window.location.hash,'');
          var url = baseUrl + "#dashboard/temp/" + result.data._id;

          return { title: data.title, url: url };

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
        size: this.searchMaxResults,
        sort: ["_uid"]
      };

      return this._post('/dashboard/_search', query)
        .then(function(results) {
          if(_.isUndefined(results.hits)) {
            return { dashboards: [], tags: [] };
          }

          var hits = { dashboards: [], tags: results.facets.tags.terms || [] };

          for (var i = 0; i < results.hits.hits.length; i++) {
            hits.dashboards.push({
              id: results.hits.hits[i]._id,
              tags: results.hits.hits[i]._source.tags
            });
          }

          hits.tagsOnly = tagsOnly;
          return hits;
        });
    };

    return ElasticDatasource;

  });

});
