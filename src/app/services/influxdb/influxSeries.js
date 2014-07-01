define([
  'underscore',
],
function (_) {
  'use strict';

  function InfluxSeries(options) {
    this.seriesList = options.seriesList;
    this.alias = options.alias;
    this.groupByField = options.groupByField;
  }

  var p = InfluxSeries.prototype;

  p.getTimeSeries = function() {
    var output = [];
    var self = this;

    _.each(self.seriesList, function(series) {
      var seriesName;
      var timeCol = series.columns.indexOf('time');
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
        for (var i = 0; i < groupPoints.length; i++) {
          var metricValue = isNaN(groupPoints[i][valueCol]) ? null : groupPoints[i][valueCol];
          datapoints[i] = [metricValue, groupPoints[i][timeCol]];
        }

        seriesName = self.alias ? self.alias : (series.name + '.' + key);

        // if mulitple groups append key to alias
        if (self.alias && self.groupByField) {
          seriesName += key;
        }

        output.push({ target: seriesName, datapoints: datapoints });
      });
    });

    return output;
  };

  return InfluxSeries;
});