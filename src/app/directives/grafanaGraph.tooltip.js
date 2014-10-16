define([
  'jquery',
],
function ($) {
  'use strict';

  function GraphTooltip(elem, dashboard, scope, getSeriesFn) {
    var self = this;

    var $tooltip = $('<div id="tooltip">');

    this.findHoverIndexFromDataPoints = function(posX, series,last) {
      var ps = series.datapoints.pointsize;
      var initial = last*ps;
      var len = series.datapoints.points.length;
      for (var j = initial; j < len; j += ps) {
        if (series.datapoints.points[j] > posX) {
          return Math.max(j - ps,  0)/ps;
        }
      }
      return j/ps - 1;
    };

    this.findHoverIndexFromData = function(posX, series) {
      var len = series.data.length;
      for (var j = 0; j < len; j++) {
        if (series.data[j][0] > posX) {
          return Math.max(j - 1,  0);
        }
      }
      return j - 1;
    };

    this.showTooltip = function(title, innerHtml, pos) {
      var body = '<div class="graph-tooltip small"><div class="graph-tooltip-time">'+ title + '</div> ' ;
      body += innerHtml + '</div>';
      $tooltip.html(body).place_tt(pos.pageX + 20, pos.pageY);
    };

    this.getMultiSeriesPlotHoverInfo = function(seriesList, pos) {
      var value, i, series, hoverIndex;
      var results = [];

      var pointCount = seriesList[0].data.length;
      for (i = 1; i < seriesList.length; i++) {
        if (seriesList[i].data.length !== pointCount) {
          results.pointCountMismatch = true;
          return results;
        }
      }

      series = seriesList[0];
      hoverIndex = this.findHoverIndexFromData(pos.x, series);
      var lasthoverIndex = 0;
      if(!scope.panel.steppedLine) {
        lasthoverIndex = hoverIndex;
      }

      //now we know the current X (j) position for X and Y values
      results.time = series.data[hoverIndex][0];
      var last_value = 0; //needed for stacked values

      for (i = 0; i < seriesList.length; i++) {
        series = seriesList[i];

        if (scope.panel.stack) {
          if (scope.panel.tooltip.value_type === 'individual') {
            value = series.data[hoverIndex][1];
          } else {
            last_value += series.data[hoverIndex][1];
            value = last_value;
          }
        } else {
          value = series.data[hoverIndex][1];
        }

        // Highlighting multiple Points depending on the plot type
        if (scope.panel.steppedLine || (scope.panel.stack && scope.panel.nullPointMode == "null")) {
          // stacked and steppedLine plots can have series with different length.
          // Stacked series can increase its length  on each new stacked serie if null points found,
          // to speed the index search we begin always on the las found hoverIndex.
          var newhoverIndex = this.findHoverIndexFromDataPoints(pos.x, series,lasthoverIndex);
          // update lasthoverIndex depends also on the plot type.
          if(!scope.panel.steppedLine) {
            // on stacked graphs new will be always greater than last
            lasthoverIndex = newhoverIndex;
          } else {
            // if steppeLine, not always series increases its length, so we should begin
            // to search correct index from the original hoverIndex on each serie.
            lasthoverIndex = hoverIndex;
          }

          results.push({ value: value, hoverIndex: newhoverIndex });
        } else {
          results.push({ value: value, hoverIndex: hoverIndex });
        }
      }

      return results;
    };

    elem.mouseleave(function () {
      if (scope.panel.tooltip.shared || dashboard.sharedCrosshair) {
        var plot = elem.data().plot;
        if (plot) {
          $tooltip.detach();
          plot.unhighlight();
          scope.appEvent('clearCrosshair');
        }
      }
    });

    elem.bind("plothover", function (event, pos, item) {
      var plot = elem.data().plot;
      var plotData = plot.getData();
      var seriesList = getSeriesFn();
      var group, value, timestamp, hoverInfo, i, series, seriesHtml;

      if(dashboard.sharedCrosshair){
        scope.appEvent('setCrosshair',  { pos: pos, scope: scope });
      }

      if (seriesList.length === 0) {
        return;
      }

      if (scope.panel.tooltip.shared) {
        plot.unhighlight();

        var seriesHoverInfo = self.getMultiSeriesPlotHoverInfo(plotData, pos);
        if (seriesHoverInfo.pointCountMismatch) {
          self.showTooltip('Shared tooltip error', '<ul>' +
            '<li>Series point counts are not the same</li>' +
            '<li>Set null point mode to null or null as zero</li>' +
            '<li>For influxdb users set fill(0) in your query</li></ul>', pos);
          return;
        }

        seriesHtml = '';
        timestamp = dashboard.formatDate(seriesHoverInfo.time);

        for (i = 0; i < seriesHoverInfo.length; i++) {
          series = seriesList[i];
          hoverInfo = seriesHoverInfo[i];
          value = series.formatValue(hoverInfo.value);

          group = '<i class="icon-minus" style="color:' + series.color +';"></i> ' + series.label;
          seriesHtml = group + ': <span class="graph-tooltip-value">' + value + '</span><br>' + seriesHtml;
          plot.highlight(i, hoverInfo.hoverIndex);
        }

        self.showTooltip(timestamp, seriesHtml, pos);
      }
      // single series tooltip
      else if (item) {
        series = seriesList[item.seriesIndex];
        group = '<i class="icon-minus" style="color:' + item.series.color +';"></i> ' + series.label;

        if (scope.panel.stack && scope.panel.tooltip.value_type === 'individual') {
          value = item.datapoint[1] - item.datapoint[2];
        }
        else {
          value = item.datapoint[1];
        }

        value = series.formatValue(value);
        timestamp = dashboard.formatDate(item.datapoint[0]);
        group += ': <span class="graph-tooltip-value">' + value + '</span><br>';

        self.showTooltip(timestamp, group, pos);
      }
      // no hit
      else {
        $tooltip.detach();
      }
    });
  }

  return GraphTooltip;
});
