define([
  'angular',
  'app',
  'lodash',
  'jquery',
  'jquery.flot',
  'jquery.flot.pie',
],
function (angular, app, _, $) {
  'use strict';

  var module = angular.module('grafana.panels.piechart', []);
  app.useModule(module);

  module.directive('piechartPanel', function() {

    return {
      link: function(scope, elem) {
        var data, panel;

        scope.$on('render', function() {
          render();
        });

        function setElementHeight() {
          var height = scope.height || panel.height || scope.row.height;
          if (_.isString(height)) {
            height = parseInt(height.replace('px', ''), 10);
          }

          height -= 10; // padding
          height -= panel.title ? 24 : 9; // subtract panel title bar

          elem.css('height', height + 'px');
        }

        function addPieChart() {
          var width = elem.width();
          var height = elem.height();

          var size = Math.min(width, height);

          var plotCanvas = $('<div></div>');
          var plotCss = {};

          plotCss.position = 'absolute';
          plotCss.top = '10px';
          plotCss.left = '10px';
          plotCss.width = (size - 20) + 'px';
          plotCss.height = (size - 20) + 'px';

          plotCanvas.css(plotCss);

          var options = {
            legend: { show: false },
            series: {
              pie: {
                show: true,
                label: { show: false }
              }
            }
          };

          if (panel.pieType === 'donut') {
            options.series.pie.innerRadius = 0.5;
          }

          elem.append(plotCanvas);

          $.plot(plotCanvas, scope.data, options);
        }

        function render() {
          if (!scope.data) { return; }

          data = scope.data;
          panel = scope.panel;

          setElementHeight();

          var body = $('<div>');
          elem.html(body);

          addPieChart();
        }
      }
    };
  });
});
