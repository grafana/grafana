define([
  'angular',
  'jquery',
  'lodash'
],
  function (angular, $, _) {
    'use strict';

    var module = angular.module('grafana.directives');

    module.directive('grafanaTable', function($rootScope, $timeout) {
      var data;
      var tableHeight;
      var sortedData;

      // paging variables
      var dataToSkip;
      var pagedData;
      var numPages = 1;
      var minPage = 1;


      var SortType = {
        none: 0,
        asc: 1,
        desc: 2
      };

      return {
        restrict: 'A',
        templateUrl: 'app/panels/table/table.html',
        link: function(scope, elem) {
          scope.height = 280; // set default height for edit mode (prob should be done elsewhere)
          scope.tablePageSize = 20;
          scope.sortType = SortType;

          // refers to the order in which the columns were requested to be sorted
          // for example, we might want to first sort by second column, then by third, then by first, etc.
          scope.columnSortOrder = [];

          scope.$on('render',function(event, renderData) {
            data = renderData || data;
            if (!data) {
              scope.get_data();
              return;
            }

            numPages = Math.ceil(data.datapoints.length / scope.tablePageSize);
            minPage = numPages > 0 ? 1 : 0;

            scope.curTablePage = minPage; // set to first page, since new data has come in
            render_panel();
          });


          scope.$watch('curTablePage', function() {
            scope.curTablePage = parseInt(scope.curTablePage) || 1; // ensure page is numeric

            if (scope.curTablePage < minPage) {
              scope.curTablePage = minPage;
            }

            if (scope.curTablePage > numPages) {
              scope.curTablePage = numPages;
            }


            if (!data) {
              return;
            }

            render_panel();
          });

          scope.headerClicked = function(header) {
            changeSortType(header);
            render_panel();
          };


          function render_panel() {
            var isHeightSet = setTableHeightVariable();
            if (shouldAbortRender(isHeightSet)) {
              return;
            }

            setHeaders();
            handleSorting();
            handlePaging();
            setTableData();

            elem.find('.table-vis-overflow-container').height(tableHeight);
            elem.height(tableHeight); // set physical height of directive

            $timeout(function() { // after angular is processing, do jquery stuff
              performHeaderPositioning();
            }, 0);
          }

          // on resize, the absolutely positioned headers will be shifted, during shift we reposition them
          $(window).resize(function() {
            performHeaderPositioning();
          });


          function setHeaders() {
            // only set headers if there has been a change, since we do not want to lose sorting options

            var curHeaders = scope.headers;

            var newHeaders = _.map(data.selectedColumns, function(columnName) {
              return { columnName: columnName, sortType: SortType.none };
            });

            if (!curHeaders) {
              scope.headers = newHeaders;
              scope.columnSortOrder = [];
              return;
            }


            var headersChanged = curHeaders.length !== newHeaders.length;
            if (!headersChanged) { // check further to see if they did change
              var curNames = _.pluck(curHeaders, 'columnName');
              var newNames = _.pluck(curHeaders, 'columnName');

              headersChanged = _.difference(curNames, newNames).length > 0;
            }


            if (headersChanged)
            {
              scope.headers = newHeaders;
              scope.columnSortOrder = [];
            }
          }

          function setTableData() {
            // avoid using angular bindings for table data in order to avoid performance penalty
            // in case user wants to view a large number of cells simultaneously
            scope.tableData = _.reduce(pagedData, function(prev, cur) {
              var row = _.map(cur, function(seriesValue) {
                return '<td>' + seriesValue  + '</td>';
              }).join('');

              row = '<tr>' + row + '</tr>';

              return prev += row;
            }, '');
          }

          function performHeaderPositioning() {
            var realHeaders = elem.find('.real-table-header');
            var fixedHeaders = elem.find('.fixed-table-header');
            var container = elem.find('.table-vis-overflow-container');

            for (var i = 0; i < realHeaders.length; ++i) {
              var realEl = realHeaders.eq(i);
              var fixedEl = fixedHeaders.eq(i);

              var borderWidth = parseFloat(realEl.css('borderWidth')) || 0;

              fixedEl.width(realEl.width() + borderWidth);
              fixedEl.css({ left: realEl.position().left, top: container.position().top });
            }

            fixedHeaders.show();
          }

          function handlePaging() {
            dataToSkip = scope.tablePageSize * (scope.curTablePage - 1);
            pagedData = sortedData.slice(dataToSkip, scope.tablePageSize + dataToSkip);
          }

          function handleSorting() {
            sortedData = [].concat(data.datapoints);
            sortedData = sortedData.slice(0, 5);

            var columnToSort = 0;
            var ascSort = true; // if true, will sort on asc, if not, by desc

            for (var i = 0; i < scope.columnSortOrder.length; ++i) {
              var header = scope.columnSortOrder[i];
              columnToSort = _.findIndex(scope.headers, header);
              if (columnToSort === -1) continue;

              if (header.sortType === SortType.asc) {
                ascSort = true;
              }
              else if (header.sortType === SortType.desc) {
                ascSort = false;
              }

              sortedData.sort(sortFunction);
            }


            function sortFunction(a, b) {
              if (a[columnToSort] === b[columnToSort]) {
                return 0;
              }
              else {
                var isConditionMet = ascSort ? a[columnToSort] < b[columnToSort] : a[columnToSort] > b[columnToSort];
                return isConditionMet ? -1 : 1;
              }
            }
          }

          function changeSortType(header) {
            var newType = null;

            switch (header.sortType) {
              case SortType.none:
                newType = SortType.asc;
                scope.columnSortOrder.push(header); // we are beginning to sort by header column, so add to array
                break;

              case SortType.asc:
                newType = SortType.desc;
                break;

              case SortType.desc:
                newType = SortType.none;
                // since we are no longer sorting, remove from sort order array
                scope.columnSortOrder = _.filter(scope.columnSortOrder, function(sortedHeader) { return header !== sortedHeader;  } );
                break;
            }

            header.sortType = newType;
          }



          function shouldAbortRender(isHeightSet) {
            if (!data) {
              return true;
            }

            if ($rootScope.fullscreen && !scope.fullscreen) {
              return true;
            }

            if (!isHeightSet) { return true; }

            if (elem.width() === 0) {
              return false;
            }
          }


          function setTableHeightVariable() {
            try {
              tableHeight = scope.height || scope.panel.height || scope.row.height;
              if (_.isString(tableHeight)) {
                tableHeight = parseInt(tableHeight.replace('px', ''), 10);
              }

              tableHeight -= 5; // padding
              tableHeight -= scope.panel.title ? 24 : 9; // subtract panel title bar

              return true;
            } catch(e) { // IE throws errors sometimes
              return false;
            }
          }

        }
      };
    });




  });
