define([
  'jquery',
  'directives/grafanaGraph.tooltip'
], function($, tooltip) {
  'use strict';

  describe('graph tooltip', function() {
    var elem = $('<div></div>');
    var dashboard = {
      formatDate: sinon.stub().returns('date'),
    };
    var scope =  {
      panel: {
        tooltip:  {
          shared: true
        },
        y_formats: ['ms', 'none'],
      }
    };

    var data = [
      {
        data: [[10,10], [12,20]],
        info: { yaxis: 1 },
        yaxis: { tickDecimals: 2 },
      },
      {
        data: [[10,10], [12,20]],
        info: { yaxis: 1 },
        yaxis: { tickDecimals: 2 },
      }
    ];

    var plot = {
      getData: sinon.stub().returns(data),
      highlight: sinon.stub(),
      unhighlight: sinon.stub()
    };

    elem.data('plot', plot);

    beforeEach(function() {
      tooltip.register(elem, dashboard, scope);
      elem.trigger('plothover', [{}, {x: 13}, {}]);
    });

    it('should add tooltip', function() {
      var tooltipHtml = $(".graph-tooltip").text();
      expect(tooltipHtml).to.be('date  : 40.00 ms : 20.00 ms');
    });

  });

});


