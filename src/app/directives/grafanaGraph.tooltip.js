define([
  'jquery',
  'kbn',
],
function ($, kbn) {
  'use strict';

  function registerTooltipFeatures(elem, dashboard, scope) {

    var $tooltip = $('<div id="tooltip">');

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

    function findHoverIndexFromDataPoints(posX, series,last) {
      var ps=series.datapoints.pointsize;
      var initial=last*ps;
      for (var j = initial; j < series.datapoints.points.length; j+=ps) {
        if (series.datapoints.points[j] > posX) {
          return Math.max(j - ps,  0)/ps;
        }
      }
      return j/ps - 1;
    }

    function findHoverIndexFromData(posX, series) {
      for (var j = 0; j < series.data.length; j++) {
        if (series.data[j][0] > posX) {
          return Math.max(j - 1,  0);
        }
      }
      return j - 1;
    }

    function showTooltip(title, innerHtml, pos) {
      var body = '<div class="graph-tooltip small"><div class="graph-tooltip-time">'+ title + '</div> ' ;
      body += innerHtml + '</div>';
      $tooltip.html(body).place_tt(pos.pageX + 20, pos.pageY);
    }

    elem.bind("plothover", function (event, pos, item) {
      var plot = elem.data().plot;
      var data = plot.getData();
      var group, value, timestamp, seriesInfo, format, i, series, hoverIndex, seriesHtml;

      if(dashboard.sharedCrosshair){
        scope.appEvent('setCrosshair',  { pos: pos, scope: scope });
      }

      if (scope.panel.tooltip.shared) {
        plot.unhighlight();

        //check if all series has same length if so, only one x index will
        //be checked and only for exact timestamp values
        var pointCount = data[0].data.length;
        for (i = 1; i < data.length; i++) {
          if (data[i].data.length !== pointCount) {
            showTooltip('Shared tooltip error', '<ul>' +
              '<li>Series point counts are not the same</li>' +
              '<li>Set null point mode to null or null as zero</li>' +
              '<li>For influxdb users set fill(0) in your query</li></ul>', pos);
            return;
          }
        }

        seriesHtml = '';
        series = data[0];
        hoverIndex = findHoverIndexFromData(pos.x, series);
        var lasthoverIndex=0;
        if(!scope.panel.steppedLine) {
          lasthoverIndex=hoverIndex;
        }

        //now we know the current X (j) position for X and Y values
        timestamp = dashboard.formatDate(series.data[hoverIndex][0]);
        var last_value = 0; //needed for stacked values

        for (i = 0; i < data.length; i++) {
          series = data[i];
          seriesInfo = series.info;
          format = scope.panel.y_formats[seriesInfo.yaxis - 1];

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

          value = kbn.valueFormats[format](value, series.yaxis.tickDecimals);

          if (seriesInfo.alias) {
            group = '<i class="icon-minus" style="color:' + series.color +';"></i> ' + seriesInfo.alias;
          } else {
            group = kbn.query_color_dot(series.color, 15) + ' ';
          }

          //pre-pending new values
          seriesHtml = group + ': <span class="graph-tooltip-value">' + value + '</span><br>' + seriesHtml;

          //Highlighting multiple Points depending on the plot type
          if (scope.panel.steppedLine || (scope.panel.stack && scope.panel.nullPointMode == "null")) {
            //stacked and steppedLine plots can have series with different length.
            //Stacked series can increase its length  on each new stacked serie if null points found,
            //to speed the index search we begin always on the las found hoverIndex.
            var newhoverIndex=findHoverIndexFromDataPoints(pos.x, series,lasthoverIndex);
            //update lasthoverIndex depends also on the plot type.
            if(!scope.panel.steppedLine) {
              //on stacked graphs new will be always greater than last
              lasthoverIndex=newhoverIndex;
            } else {
              //if steppeLine, not always series increases its length, so we should begin
              //to search correct index from the original hoverIndex on each serie.
              lasthoverIndex=hoverIndex;
            }
            plot.highlight(i, newhoverIndex);
          } else {
            plot.highlight(i, hoverIndex);
          }
        }

        showTooltip(timestamp, seriesHtml, pos);
        return;
      }
      if (item) {
        seriesInfo = item.series.info;
        format = scope.panel.y_formats[seriesInfo.yaxis - 1];
        group = '<i class="icon-minus" style="color:' + item.series.color +';"></i> ' + seriesInfo.alias;

        if (scope.panel.stack && scope.panel.tooltip.value_type === 'individual') {
          value = item.datapoint[1] - item.datapoint[2];
        }
        else {
          value = item.datapoint[1];
        }

        value = kbn.valueFormats[format](value, item.series.yaxis.tickDecimals);
        timestamp = dashboard.formatDate(item.datapoint[0]);
        group += ': <span class="graph-tooltip-value">' + value + '</span>';

        showTooltip(timestamp, group, pos);
      } else {
        $tooltip.detach();
      }
    });

  }

  return {
    register: registerTooltipFeatures
  };
});
