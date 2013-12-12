define([
  'angular',
  'underscore',
  'config'
],
function (angular, _, config) {
  'use strict';

  var module = angular.module('kibana.controllers');

  module.controller('MetricKeysCtrl', function($scope, $http) {

    $scope.init = function () {
      $scope.metricPath = "prod.apps.api.boobarella.*";
    };

    $scope.loadMetricsFromPath = function () {
      $scope.infoText = 'loading';
      loadMetricsRecursive($scope.metricPath)

      /*$http.put(config.elasticsearch + "/grafana-int/", {
{
  "settings": {
    "analysis": {
      "analyzer": {
        "category_path": {
          "type": "custom",
          "tokenizer": "category_path"
        },
        "my_ngram_analyzer" : {
      "tokenizer" : "my_ngram_tokenizer"
    }
      },
      "tokenizer": {
        "category_path": {
          "type": "path_hierarchy",
          "delimiter": "."
        },
        "my_ngram_tokenizer" : {
          "type" : "nGram",
          "min_gram" : "4",
          "max_gram" : "8",
          "token_chars": [ "letter", "digit" ]
        }
      }
    }
  },
  "mappings": {
    "metricKey": {
      "properties": {
        "metricPath": {
          "type": "string",
          "index": "analyzed",
          "index_analyzer": "my_ngram_analyzer"
    }
      }
    }
  }
}
      });*/
    };

    function receiveMetric(data) {
      if (!data || data.length == 0) {
        console.log('no data');
        return;
      }

      _.each(data, function(metric) {
        if (metric.expandable) {
          console.log('Loading children: ' + metric.id);
          loadMetricsRecursive(metric.id + ".*");
        }
        if (metric.leaf) {
          saveMetricKey(metric.id);
        }
      });
    }

    function saveMetricKey(metricId) {

      // Create request with id as title. Rethink this.
      var request = ejs.Document(config.grafana_index, 'metricKey', metricId).source({
        metricPath: metricId
      });

      request.doIndex(
        // Success
        function(result) {
          console.log('save metric success', result);
        },
        function(error) {
          console.log('save metric error', error);
        }
      );
    }

    function metricLoadError(data, status, headers, config)
    {
      console.log('error: ' + status);
      $scope.error = "failed to get metrics from graphite";
    }

    function loadMetricsRecursive(metricPath, data, callback)
    {
      $http({ method: 'GET', url: config.graphiteUrl + '/metrics/find/?query=' + metricPath} )
        .success(receiveMetric)
        .error(metricLoadError);
    }

  });

});