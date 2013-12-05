define([
  'jquery',
  'angular',
  'app',
  'underscore',
  'ts-widget'
],
function ($, angular, app, _, timeseriesWidget) {
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
        link: function (scope, elem, attrs) {
            var tsData = {
              graphite_url: 'http://localhost:3030/data',
              from: '-24hours',
              until: 'now',
              height: '300',
              width: '740',
              targets: [
                  {
                    name: 'series 1',
                    color: '#CC6699',
                    target: 'random1',
                  }
              ],
              title: 'horizontal title',
              vtitle: 'vertical title',
              drawNullAsZero: false,
              legend: { container: '#legend_flot_simple', noColumns: 1 },
          };
          $("#chart_flot").graphiteFlot(tsData, function(err) {
            console.log(err);
          });

            console.log('asd');
            $(elem).html('NJEEEJ!');
            /*// If the data changes somehow, update it in the chart
            scope.$watch('data', function(v){
                 if(!chart){
                    chart = $.plot(elem, v , options);
                    elem.show();
                }else{
                    chart.setData(v);
                    chart.setupGrid();
                    chart.draw();
                }
            });*/
        }
    };

  });

});