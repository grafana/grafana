///// @scratch /configuration/config.js/1
 // == Configuration
 // config.js is where you will find the core Grafana configuration. This file contains parameter that
 // must be set before Grafana is run for the first time.
 ///
define(['settings'],
function (Settings) {
  "use strict";

  return new Settings({

    // datasources, you can add multiple
    datasources: {
      graphite: {
        type: 'graphite',
        url: "http://my.graphite.server.com:8080",
        default: true
      },
      influxdb: {
        type: 'influxdb',
        url: "http://my_influxdb_server:8086/db/database_name",
        username: 'admin',
        password: 'admin'
      },
    },

    // elasticsearch url
    // used for storing and loading dashboards, optional
    // For Basic authentication use: http://username:password@domain.com:9200
    elasticsearch: "http://"+window.location.hostname+":9200",

    // default start dashboard
    default_route: '/dashboard/file/default.json',

    // Elasticsearch index for storing dashboards
    grafana_index: "grafana-dash",

    // set to false to disable unsaved changes warning
    unsaved_changes_warning: true,

    // set the default timespan for the playlist feature
    // Example: "1m", "1h"
    playlist_timespan: "1m",

    plugins: {
      panels: []
    },

    /**
     * Default value for cacheTimeout option sent to graphite
     * null means grafana will not send the option
     * refer to graphite documentation for more information
     */
    cacheTimeout: null
  });
});
