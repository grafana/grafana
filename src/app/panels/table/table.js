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


            var tableData = _.reduce(data.datapoints, function(prev, cur) {
              var row = _.map(cur, function(seriesValue) {
                return '<td>' + seriesValue  + '</td>';
              }).join('');

              row = '<tr>' + row + '</tr>';

              return prev += row;
            }, '');



            var html =
              '<table>' +
                '<tr>' + headers + '</tr>' +
                tableData +
              '</table>';



            elem.html(html);
            $compile(elem.contents())(scope);
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
              return;
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
