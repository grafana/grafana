define([],
  function() {
  'use strict';

  return {
    create: function() {
      return {
        refresh: function() {},
        set_interval: function(value) { this.current.refresh = value; },

        current: {
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
          services: {},
          loader: {
            save_gist: false,
            save_elasticsearch: true,
            save_local: true,
            save_default: true,
            save_temp: true,
            save_temp_ttl_enable: true,
            save_temp_ttl: '30d',
            load_gist: false,
            load_elasticsearch: true,
            load_elasticsearch_size: 20,
            load_local: false,
            hide: false
          },
          refresh: true
        }
      };
    }
  };
});
