define([
  'underscore',
], function (_) {
  'use strict';

  function DalmatinerSeries(seriesList) {
    this.seriesList = seriesList;
  }

  var p = DalmatinerSeries.prototype;

  p.getTimeSeries = function() {
    var output = [];
    var self = this;

    _.each(self.seriesList, function(series) {
      var seriesName = series.n;
      var seriesData = series.v;
      var seriesResolution = series.r / 1000;
      var t = (new Date().getTime()/1000) - (seriesData.length * seriesResolution);
      seriesData = seriesData.map(function(e, i) {
        return [e, t+(i*seriesResolution)];
      });
      /*      var timeCol = series.columns.indexOf('time');
              var valueCol = 1;
              var groupByCol = -1;

              if (self.groupByField) {
              groupByCol = series.columns.indexOf(self.groupByField);
              }

              // find value column
              _.each(series.columns, function(column, index) {
              if (column !== 'time' && column !== 'sequence_number' && column !== self.groupByField) {
              valueCol = index;
              }
              });

              var groups = {};

              if (self.groupByField) {
              groups = _.groupBy(series.points, function (point) {
              return point[groupByCol];
              });
              }
              else {
              groups[series.columns[valueCol]] = series.points;
              }

              _.each(groups, function(groupPoints, key) {
              var datapoints = [];
              for (i = 0; i < groupPoints.length; i++) {
              var metricValue = isNaN(groupPoints[i][valueCol]) ? null : groupPoints[i][valueCol];
              datapoints[i] = [metricValue, groupPoints[i][timeCol]];
              }

              seriesName = series.name + '.' + key;

              if (self.alias) {
              seriesName = self.createNameForSeries(series.name, key);
              }

              });
      */

      output.push({ target: seriesName, datapoints: seriesData });

    });
    return output;
  };

  return DalmatinerSeries;
});
