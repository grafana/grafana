define([],
  function() {
  'use strict';

  return {
    create: function() {
      return {
        emit_refresh: function() {},
        set_interval: function(value) { this.refresh = value; },

        title: "",
        tags: [],
        style: "dark",
        timezone: 'browser',
        editable: true,
        failover: false,
        panel_hints: true,
        rows: [],
        pulldowns: [ { type: 'templating' },  { type: 'annotations' } ],
        nav: [ { type: 'timepicker' } ],
        time: {},
        templating: {
          list: []
        },
        refresh: true
      };
    }
  };
});
