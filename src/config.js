/** @scratch /configuration/config.js/1
 * == Configuration
 * config.js is where you will find the core Grafana configuration. This file contains parameter that
 * must be set before kibana is run for the first time.
 */
define(['settings'],
function (Settings) {
  "use strict";

  /** @scratch /configuration/config.js/2
   * === Parameters
   */
  return new Settings({

    /** @scratch /configuration/config.js/5
     * ==== elasticsearch
     *
     * The URL to your elasticsearch server. You almost certainly don't
     * want +http://localhost:9200+ here. Even if Grafana and Elasticsearch are on
     * the same host. By default this will attempt to reach ES at the same host you have
     * Grafana installed on. You probably want to set it to the FQDN of your
     * elasticsearch host
     */
    elasticsearch: "http://"+window.location.hostname+":9200",

    graphiteUrl: "http://"+window.location.hostname+":8080",

    /** @scratch /configuration/config.js/5
     * ==== default_route
     *
     * This is the default landing page when you don't specify a dashboard to load. You can specify
     * files, scripts or saved dashboards here. For example, if you had saved a dashboard called
     * `WebLogs' to elasticsearch you might use:
     *
     * +default_route: '/dashboard/elasticsearch/WebLogs',+
     */
    default_route     : '/dashboard/file/default.json',

    /** @scratch /configuration/config.js/5
     * ==== Grafana-int
     *
     * The default ES index to use for storing Grafana specific object
     * such as stored dashboards
     */
    kibana_index: "kibana-int",
    grafana_index: "grafana-int",

    /** @scratch /configuration/config.js/5
     * ==== panel_name
     *
     * An array of panel modules available. Panels will only be loaded when they are defined in the
     * dashboard, but this list is used in the "add panel" interface.
     */
    panel_names: [
      'text',
      'graphite'
    ]
  });
});
