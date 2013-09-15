define(['jquery'],
function ($) {
  'use strict';

  /**
   * jQuery extensions
   */
  var $win = $(window);

  $.fn.place_tt = (function () {
    var defaults = {
      offset: 5,
      css: {
        position : 'absolute',
        top : -1000,
        left : 0,
        color : "#c8c8c8",
        padding : '10px',
        'font-size': '11pt',
        'font-weight' : 200,
        'background-color': '#1f1f1f',
        'border-radius': '5px',
      }
    };

    return function (x, y, opts) {
      opts = $.extend(true, {}, defaults, opts);
      return this.each(function () {
        var $tooltip = $(this), width, height;

        $tooltip.css(opts.css);
        if (!$.contains(document.body, $tooltip[0])) {
          $tooltip.appendTo(document.body);
        }

        width = $tooltip.outerWidth(true);
        height = $tooltip.outerHeight(true);

        $tooltip.css('left', x + opts.offset + width > $win.width() ? x - opts.offset - width : x + opts.offset);
        $tooltip.css('top', y + opts.offset + height > $win.height() ? y - opts.offset - height : y + opts.offset);
      });
    };
  })();

  return $;
});