define([
  'angular',
  'jquery',
  'kbn',
  'moment',
  'lodash'
],
  function (angular, $, kbn, moment, _) {
    'use strict';

    var module = angular.module('grafana.directives');
    var data;
    var tableHeight;
    var headerHeight = 25;

    module.directive('grafanaTable', function($rootScope, timeSrv, $compile) {
      return {
        restrict: 'A',
        link: function(scope, elem) {
          scope.$on('renderTable',function(event, renderData) {
            data = renderData || data;
            if (!data) {
              scope.get_data();
              return;
            }

            render_panel();
          });


          function render_panel() {
            if (shouldAbortRender()) {
              return;
            }


            var headers = _.map(data.selectedColumns, function(columnName) {
              return '<th>' + columnName +  '</th>';
            }).join('');

            headers = '<tr>' + headers + '</tr>';

            var tableData = _.reduce(data.datapoints, function(prev, cur) {
              var row = _.map(cur, function(seriesValue) {
                return '<td>' + seriesValue  + '</td>';
              }).join('');

              row = '<tr>' + row + '</tr>';

              return prev += row;
            }, '');



            var html =
              '<div style="position: relative; margin-top:' + headerHeight +'px;">' +
                '<div style="height: ' + (tableHeight) + 'px; overflow: auto;">' +
                  '<table>' +

                    '<thead>' +
                      headers +
                    '</thead>' +

                    '<tbody>' +
                      tableData +
                    '</tbody>' +

                  '</table>' +
                '</div>' +
              '</div>';



            elem.html(html);
            $compile(elem.contents())(scope);

            // we need to hardcode header widths so they do not get lost when the headers become fixed
            var ths = elem.find('thead th');
            for (var i = 0; i < ths.length; ++i) {
              var el = ths.eq(i);
              var width = el.width();
              el.css('width', width);
            }


            elem.find('thead')
              .css('position', 'absolute')
              .css('top', -headerHeight + 'px'); // create distance from headers and body
          }


          function shouldAbortRender() {
            if (!data) {
              return true;
            }

            if ($rootScope.fullscreen && !scope.fullscreen) {
              return true;
            }

            if (!setElementHeight()) { return true; }

            if (elem.width() === 0) {
              return false;
            }
          }


          function setElementHeight() {
            try {
              tableHeight = scope.height || scope.panel.height || scope.row.height;
              if (_.isString(tableHeight)) {
                tableHeight = parseInt(tableHeight.replace('px', ''), 10);
              }

              tableHeight -= 5; // padding
              tableHeight -= scope.panel.title ? 24 : 9; // subtract panel title bar
              tableHeight -= headerHeight;


              elem.css('height', tableHeight + 'px');

              return true;
            } catch(e) { // IE throws errors sometimes
              return false;
            }
          }


        }
      };
    });




  });
