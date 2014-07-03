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
        var i;

        _.each(self.seriesList, function(series) {
            console.log("series", series);
            var seriesName = series.n;
            var seriesData = series.v;
            var seriesResolution = series.r;
            var t = (new Date().getTime()/1000) - (seriesData.length * seriesResolution);
            seriesData = seriesData.map(function(e, i) {
                return [e, t+(i*seriesResolution)];
            })
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

            output.push({ target: series.n, datapoints: seriesData });

        });
        console.log(output);
        return output;
    };

    p.createNameForSeries = function(seriesName, groupByColValue) {
        var name = this.alias
            .replace('$s', seriesName);

        var segments = seriesName.split('.');
        for (var i = 0; i < segments.length; i++) {
            if (segments[i].length > 0) {
                name = name.replace('$' + i, segments[i]);
            }
        }

        return name;
    };

    return DalmatinerSeries;
});
