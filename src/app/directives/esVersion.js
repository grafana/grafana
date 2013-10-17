/*
  Only show an element if it meets an Elasticsearch version requirement
*/

define([
  'angular',
  'app',
],
function (angular) {
  'use strict';

  angular
    .module('kibana.directives')
    .directive('esVersion', function(esVersion) {
      return {
        restrict: 'A',
        link: function(scope, elem, attr) {
          if(!esVersion.is(attr.esVersion)) {
            elem.hide();
          }
        }
      };
    });
});