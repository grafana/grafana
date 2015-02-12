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

  module.directive('piechartPanel', function($location, linkSrv, $timeout) {

    return {
      link: function(scope, elem) {
        var data, panel;

        scope.$on('render', function() {
          render();
        });

        function setElementHeight() {
          try {
            var height = scope.height || panel.height || scope.row.height;
            if (_.isString(height)) {
              height = parseInt(height.replace('px', ''), 10);
            }

            height -= 5; // padding
            height -= panel.title ? 24 : 9; // subtract panel title bar

            elem.css('height', height + 'px');

            return true;
          } catch(e) { // IE throws errors sometimes
            return false;
          }
        }

        function addPieChart() {
          var width = elem.width() + 20;
          var height = elem.height() || 200;

          var plotCanvas = $('<div></div>');
          var plotCss = {};
          plotCss.position = 'absolute';

          plotCss.top = '10px';
          plotCss.left = '10px';
          plotCss.width = (width - 10) + 'px';
          plotCss.height = (height - 45) + 'px';

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

          if (panel.legend.show) {
            options.legend = {
              show: true,
              labelFormatter: function(label, series) {
                return label + " - " + series.data[0][1];
              },
              margin: '25px'
            };
          }

          elem.append(plotCanvas);

          $.plot(plotCanvas, scope.data, options);
        }

        function render() {
          if (!scope.data) { return; }

          data = scope.data;
          panel = scope.panel;

          setElementHeight();

          var body = '<div></div>';

          elem.html(body);
          addPieChart();

          elem.toggleClass('pointer', panel.links.length > 0);
        }

        // drilldown link tooltip
        var drilldownTooltip = $('<div id="tooltip" class="">gello</div>"');

        elem.mouseleave(function() {
          if (panel.links.length === 0) { return;}
          drilldownTooltip.detach();
        });

        elem.click(function() {
          if (panel.links.length === 0) { return; }

          var linkInfo = linkSrv.getPanelLinkAnchorInfo(panel.links[0]);
          if (linkInfo.href[0] === '#') { linkInfo.href = linkInfo.href.substring(1); }

          if (linkInfo.href.indexOf('http') === 0) {
            window.location.href = linkInfo.href;
          } else {
            $timeout(function() {
              $location.url(linkInfo.href);
            });
          }

          drilldownTooltip.detach();
        });

        elem.mousemove(function(e) {
          if (panel.links.length === 0) { return;}

          drilldownTooltip.text('click to go to: ' + panel.links[0].title);

          drilldownTooltip.place_tt(e.pageX+20, e.pageY-15);
        });
      }
    };
  });

});
