define([
  'jquery',
  'kbn',
],
function ($, kbn) {
  'use strict';

  function registerTooltipFeatures(elem, dashboard, scope) {

    var $tooltip = $('<div id="tooltip">');

    elem.mouseleave(function () {
      if(scope.panel.tooltip.shared) {
        var plot = elem.data().plot;
        $tooltip.detach();
        plot.clearCrosshair();
        plot.unhighlight();
      }
    });

    function findHoverIndex(posX, series) {
      for (var j = 0; j < series.data.length; j++) {
        if (series.data[j][0] > posX) {
          return Math.max(j - 1,  0);
        }
      }
      return j - 1;
    }

    elem.bind("plothover", function (event, pos, item) {
      var plot = elem.data().plot;
      var data = plot.getData();
      var group, value, timestamp, seriesInfo, format, i, series, hoverIndex, seriesHtml;

      if (scope.panel.tooltip.shared) {
        plot.unhighlight();

        //check if all series has same length if so, only one x index will
        //be checked and only for exact timestamp values
        var pointCount = data[0].data.length;
        for (i = 1; i < data.length; i++) {
          if (data[i].data.length !== pointCount) {
            console.log('WARNING: tootltip shared can not be shown becouse of series points do not align, different point counts');
            $tooltip.detach();
            return;
          }
        }

        seriesHtml = '';
        series = data[0];
        hoverIndex = findHoverIndex(pos.x, series);

        //now we know the current X (j) position for X and Y values
        timestamp = dashboard.formatDate(series.data[hoverIndex][0]);
        var last_value = 0; //needed for stacked values

        for (i = data.length-1; i >= 0; --i) {
          //stacked values should be added in reverse order
          series = data[i];
          seriesInfo = series.info;
          format = scope.panel.y_formats[seriesInfo.yaxis - 1];

          if (scope.panel.stack && scope.panel.tooltip.value_type === 'individual') {
            value = series.data[hoverIndex][1];
          } else {
            last_value += series.data[hoverIndex][1];
            value = last_value;
          }

          value = kbn.valueFormats[format](value, series.yaxis.tickDecimals);

          if (seriesInfo.alias) {
            group = '<i class="icon-minus" style="color:' + series.color +';"></i> ' + seriesInfo.alias;
          } else {
            group = kbn.query_color_dot(series.color, 15) + ' ';
          }

          //pre-pending new values
          seriesHtml = group + ': <span class="graph-tooltip-value">' + value + '</span><br>' + seriesHtml;

          plot.highlight(i, hoverIndex);
        }

        $tooltip.html('<div class="graph-tooltip small"><div class="graph-tooltip-time">'+ timestamp + '</div> ' + seriesHtml + '</div>')
          .place_tt(pos.pageX + 20, pos.pageY);
        return;
      }
      if (item) {
        seriesInfo = item.series.info;
        format = scope.panel.y_formats[seriesInfo.yaxis - 1];

        if (seriesInfo.alias) {
          group = '<small style="font-size:0.9em;">' +
            '<i class="icon-circle" style="color:'+item.series.color+';"></i>' + ' ' +
            seriesInfo.alias +
            '</small><br>';
        } else {
          group = kbn.query_color_dot(item.series.color, 15) + ' ';
        }

        if (scope.panel.stack && scope.panel.tooltip.value_type === 'individual') {
          value = item.datapoint[1] - item.datapoint[2];
        }
        else {
          value = item.datapoint[1];
        }

        value = kbn.valueFormats[format](value, item.series.yaxis.tickDecimals);
        timestamp = dashboard.formatDate(item.datapoint[0]);

        $tooltip.html(group + value + " @ " + timestamp).place_tt(pos.pageX, pos.pageY);
      } else {
        $tooltip.detach();
      }
    });

  }

  return {
    register: registerTooltipFeatures
  };
});
