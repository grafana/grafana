define([
  'angular',
],
function (angular) {
  'use strict';

  var module = angular.module('grafana.services');

  module.service('utilSrv', function($rootScope, $modal, $q) {

    this.init = function() {
      $rootScope.onAppEvent('show-modal', this.showModal);
    };

    this.showModal = function(e, options) {
      var modal = $modal({
        template: options.src,
        persist: false,
        show: false,
        scope: options.scope,
        keyboard: false
      });

      $q.when(modal).then(function(modalEl) {
        modalEl.modal('show');
      });
    };

    this.sortType = {
      none: 0, // generally none will not be passed to the sort
      asc: 1,
      desc: 2
    };

    /**
     * Allows the ability to do multi level sorting on a table (array of arrays)
     * For example, to sort by column 3 in ascending order and then column 1 in desc:
     * multiColumnSort([3,1], [sortType.asc, sortType.desc])
     *
     * @param data Multi column table to sort
     * @param {Array} columnSortOrder The indexes of the columns to sort by.
     * This does not need to include necessarily every column in the table, simply the ones we want to sort
     * @param {Array} columnSortTypes Specifies the sort type of the columnsToSort
     */
    this.multiColumnSort = function(data, columnSortOrder, columnSortTypes) {
      var sortType = this.sortType;

      function sortFunction(a, b){
        var temp = 0;

        for (var i = 0; i < columnSortOrder.length; ++i) {
          var columnIndex = columnSortOrder[i]; // take from list of column sort priority
          var columnSortType = columnSortTypes[i];

          if (columnSortType === sortType.none) {
            return temp; // no need to sort on column
          }

          var ascSort = columnSortType === sortType.asc;
          temp = compareItems(a[columnIndex], b[columnIndex], ascSort);

          if (temp !== 0) {
            break;
          }
        }

        return temp;
      }

      function compareItems(itm1, itm2, ascSort) {
        if (itm1 === itm2) {
          return 0;
        }
        else {
          var isConditionMet = ascSort ? itm1 < itm2 : itm1 > itm2;
          return isConditionMet ? -1 : 1;
        }
      }

      if (!columnSortOrder || !columnSortTypes || columnSortOrder.length !== columnSortTypes.length) {
        throw 'Specified columns to sort do not have defined sort types';
      }

      if (columnSortOrder.length === 0) {
        return;
      }

      data.sort(sortFunction);
    };

  });

});
