///// @scratch /configuration/config.js/1
 // == Configuration
 // config.js is where you will find the core Grafana configuration. This file contains parameter that
 // must be set before Grafana is run for the first time.
 ///
define(['settings'],
function (Settings) {
  "use strict";

  return new Settings({

    /* Data sources
    * ========================================================
    * Datasources are used to fetch metrics, annotations, and serve as dashboard storage
    *  - You can have multiple of the same type.
    *  - grafanaDB: true    marks it for use for dashboard storage
    *  - default: true      marks the datasource as the default metric source (if you have multiple)
    *  - basic authentication: use url syntax http://username:password@domain:port
    */

    // InfluxDB example setup (the InfluxDB databases specified need to exist)
    /*
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
        password: 'admin',
      },
      grafana: {
        type: 'influxdb',
        url: "http://my_influxdb_server:8086/db/grafana",
        username: 'admin',
        password: 'admin',
        grafanaDB: true
      },
    },
    */

    // Graphite & Elasticsearch example setup
    /*
    datasources: {
      graphite: {
        type: 'graphite',
        url: "http://my.graphite.server.com:8080",
      },
      elasticsearch: {
        type: 'elasticsearch',
        url: "http://my.elastic.server.com:9200",
        index: 'grafana-dash',
        grafanaDB: true,
      }
    },
    */

    // OpenTSDB & Elasticsearch example setup
    datasources: {
    /*
      opentsdb: {
        type: 'opentsdb',
        url: "http://opentsdb.server:4242",
      },
      elasticsearch: {
        type: 'elasticsearch',
        url: "http://my.elastic.server.com:9200",
        index: 'grafana-dash',
        grafanaDB: true,
      }
      */
      mon: {
        type: 'mon',
        url: "http://192.168.10.4:8080/v2.0",
        default: true
      }
    },

    /* Global configuration options
    * ========================================================
    */

    // specify the limit for dashboard search results
    search: {
      max_results: 20
    },

    // default start dashboard
    default_route: '/dashboard/file/default.json',

    // set to false to disable unsaved changes warning
    unsaved_changes_warning: true,

    // set the default timespan for the playlist feature
    // Example: "1m", "1h"
    playlist_timespan: "1m",

    // If you want to specify password before saving, please specify it bellow
    // The purpose of this password is not security, but to stop some users from accidentally changing dashboards
    admin: {
      password: ''
    },

    // Add your own custom pannels
    plugins: {
      panels: []
    }

  });
});
