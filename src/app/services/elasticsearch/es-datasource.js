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
      this.annotationEditorSrc = 'app/partials/elasticsearch/annotation_editor.html';
    }

    ElasticDatasource.prototype._request = function(method, url, data) {
      var options = {
        url: this.url + "/" + this.index + url,
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

    ElasticDatasource.prototype._get = function(url) {
      return this._request('GET', url)
        .then(function(results) {
          return results.data;
        });
    };

    ElasticDatasource.prototype._post = function(url, data) {
      return this._request('POST', url, data)
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

      this.index = annotation.index;

      return this._request('POST', '/_search', data).then(function(results) {
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

    return ElasticDatasource;

  });

});
