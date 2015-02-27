define([
  'angular',
],
function (angular) {
  'use strict';

  var module = angular.module('grafana.services');

  module.factory('MyDataSource', function() {

    function MyDataSource(datasource) {
      this.type = 'my_ds';
      this.datasource = datasource;
    }

    return MyDataSource;

  });

});
