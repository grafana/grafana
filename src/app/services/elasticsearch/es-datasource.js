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
      this.annotationEditorSrc = 'app/partials/elasticsearch/annotation_editor.html';
    }

    ElasticDatasource.prototype.annotationQuery = function(annotation, filterSrv, rangeUnparsed) {
    };

    return ElasticDatasource;

  });

});
