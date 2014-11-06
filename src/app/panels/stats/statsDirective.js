define([
  'angular',
  'app',
  'lodash',
  'kbn',
  'jquery',
  'jquery.flot',
  'jquery.flot.time',
],
function (angular, app, _, kbn, $) {
  'use strict';

  var module = angular.module('grafana.panels.stats', []);
  app.useModule(module);

  module.directive('statsPanel', function() {

    return {
      link: function(scope, elem) {
        var data;
        var $panelContainer = elem.parents('.panel-container');

        scope.$on('render', function() {
          data = scope.data;

          if (!data || data.flotpairs.length === 0) {
            elem.html('no data');
            return;
          }

          render();
        });

        function setElementHeight() {
          try {
            var height = scope.height || scope.panel.height || scope.row.height;
            if (_.isString(height)) {
              height = parseInt(height.replace('px', ''), 10);
            }

            height -= scope.panel.title ? 24 : 9; // subtract panel title bar

            elem.css('height', height + 'px');

            return true;
          } catch(e) { // IE throws errors sometimes
            return false;
          }
        }

        function applyColoringThresholds(value, valueString) {
          if (!scope.panel.colorValue) {
            return valueString;
          }

          var color = getColorForValue(value);
          if (color) {
            return '<span style="color:' + color + '">'+ valueString + '</span>';
          }

          return valueString;
        }

        function getColorForValue(value) {
          for (var i = data.thresholds.length - 1; i >= 0 ; i--) {
            if (value > data.thresholds[i]) {
              return data.colorMap[i];
            }
          }
          return null;
        }

        function getBigValueHtml() {
          return applyColoringThresholds(data.mainValue, data.mainValueFormated);
        }

        function addSparkline() {
          var panel = scope.panel;
          var width = elem.width() + 20;
          var height = elem.height() || 100;

          var plotCanvas = $('<div></div>');
          var plotCss = {};
          plotCss.position = 'absolute';

          if (panel.sparkline.full) {
            plotCss.bottom = '5px';
            plotCss.left = '-5px';
            plotCss.width = (width - 10) + 'px';
            plotCss.height = (height - 45) + 'px';
          }
          else {
            plotCss.bottom = "0px";
            plotCss.left = "-5px";
            plotCss.width = (width - 10) + 'px';
            plotCss.height = Math.floor(height * 0.3) + "px";
          }

          plotCanvas.css(plotCss);

          var options = {
            legend: { show: false },
            series: {
              lines:  {
                show: true,
                fill: 1,
                lineWidth: 1,
                fillColor: panel.sparkline.fillColor,
              },
            },
            yaxes: { show: false },
            xaxis: {
              show: false,
              mode: "time",
              min: scope.range.from.getTime(),
              max: scope.range.to.getTime(),
            },
            grid: { hoverable: false, show: false },
          };

          elem.append(plotCanvas);

          var plotSeries = {
            data: data.flotpairs,
            color: panel.sparkline.lineColor
          };

          setTimeout(function() {
            $.plot(plotCanvas, [plotSeries], options);
          }, 10);
        }

        function render() {
          setElementHeight();

          var panel = scope.panel;
          var body = '';

          body += '<div class="stats-panel-value-container">';
          body += '<span class="stats-panel-value">';
          body += getBigValueHtml();
          body += '</div>';
          body += '</div>';

          if (panel.colorBackground && data.mainValue) {
            var color = getColorForValue(data.mainValue);
            if (color) {
              $panelContainer.css('background-color', color);
              if (scope.fullscreen) {
                elem.css('background-color', color);
              } else {
                elem.css('background-color', '');
              }
            }
          } else {
            $panelContainer.css('background-color', '');
            elem.css('background-color', '');
          }

          elem.html(body);

          if (panel.sparkline.show) {
            addSparkline();
          }
        }
      }
    };
  });

});
