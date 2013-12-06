define([
  'jquery',
  'angular',
  'app',
  'underscore',
  'ts-widget'
],
function ($, angular, app, _) {
  'use strict';

  var module = angular.module('kibana.panels.graph', []);
  app.useModule(module);

  module.controller('graph', function($scope) {
    $scope.panelMeta = {
      status  : "Unstable",
      description : "A graphite graph module"
    };

    // Set and populate defaults
    var _d = {
    };

    _.defaults($scope.panel,_d);

    $scope.init = function() {
      $scope.ready = false;
      $scope.saySomething = "something!";
    };

  });

  angular
    .module('kibana.directives')
    .directive('mychart', function () {
      return {
        restrict: 'E',
        link: function (scope, elem) {
          var tsData = {
            from: '-30d',
            until: 'now',
            height: '300',
            width: '740',
            targets: [
              {
                name: 'series 1',
                color: '#CC6699',
                target: 'randomWalk("random1")',
              },
              {
                name: 'series 2',
                color: '#006699',
                target: 'randomWalk("random2")',
              }
            ],
            title: 'horizontal title',
            vtitle: 'vertical title',
            drawNullAsZero: false,
            state: 'stacked',
            hover_details: true,
            legend: { container: '#legend_flot_simple', noColumns: 4 },
          };

          $("#chart_flot").graphiteFlot(tsData, function(err) {
            console.log(err);
          });

          console.log('asd');
          $(elem).html('NJEEEJ!');
        }
      };
    });

});