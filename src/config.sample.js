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
    /*
    datasources: {
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
    },
    */

    /* Global configuration options
    * ========================================================
    */

    /* title:
    * The global page title prefix that is prepended before the specific dashboard titles.
    * Defaults to 'Grafana - '.
    *
    * title: undefined, // default prefix, page title = 'Grafana - <dashboard title>'
    * title: null, // no prefix, page title = <dashboard title>
    * title: '', // no prefix, page title = <dashboard title>
    * title: 'Custom | ', // custom prefix, page title = 'Custom | <dashboard title>'
    */
    title: undefined,

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
      // list of plugin panels
      panels: [],
      // requirejs modules in plugins folder that should be loaded
      // for example custom datasources
      dependencies: [],
    }

  });
});
