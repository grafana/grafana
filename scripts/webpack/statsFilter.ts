export const statsFilter = {
  exclude: /@kusto|monaco-editor|public\/locales/,
  minDominance: 0.75,
  requestUrls: `
http://localhost:3000/d/fdvnajo8la5mob/empty?from=now-6h&to=now&timezone=browser
http://localhost:3000/public/build/grafana.app.65cff3b3a422b680b421.css
http://localhost:3000/public/build/grafana.dark.04cc15f4008a63621333.css
http://localhost:3000/public/build/runtime.177d434678fea8de975e.js
http://localhost:3000/public/build/19044.d3980153597f2ee4b990.js
http://localhost:3000/public/build/97301.1822a478d201ca8cccac.js
http://localhost:3000/public/build/app.5b78150975404d4c8c68.js
http://localhost:3000/public/build/img/grafana_icon.svg
http://localhost:3000/public/build/PrometheusAlertingPluginAvailability.6415157f8d440d927a04.js
http://localhost:3000/apis/features.grafana.app/v0alpha1/namespaces/default/ofrep/v1/evaluate/flags
http://localhost:3000/public/build/img/fav32.png
http://localhost:3000/public/build/71266.c3f1559e096f5f149bc1.js
ws://localhost:3000/api/live/ws
http://localhost:3000/api/plugins/grafana-exploretraces-app/settings
http://localhost:3000/api/plugins/grafana-lokiexplore-app/settings
http://localhost:3000/api/plugins/grafana-metricsdrilldown-app/settings
http://localhost:3000/api/plugins/grafana-pyroscope-app/settings
http://localhost:3000/public/fonts/inter/Inter-Regular.woff2
http://localhost:3000/public/plugins/grafana-exploretraces-app/module.js?_cache=2.2.1
http://localhost:3000/public/build/96893.41bae571e47888be14af.js
http://localhost:3000/public/build/DashboardPageProxy.803314d70c4dcda02bb5.js
http://localhost:3000/public/build/static/img/grafana_icon.1e0deb6b.svg
http://localhost:3000/public/plugins/grafana-lokiexplore-app/module.js?_cache=2.6.0
http://localhost:3000/public/plugins/grafana-pyroscope-app/module.js?_cache=2.3.1
http://localhost:3000/public/plugins/grafana-metricsdrilldown-app/module.js?_cache=2.5.1
http://localhost:3000/public/build/49812.ff8d3f851538b59d778a.js
http://localhost:3000/public/build/1044.e0b528d98cc1b4be9bd9.js
http://localhost:3000/public/build/22100.858a2e5c53c2b2c14b85.js
http://localhost:3000/public/build/20472.59c46f916ff48712d4d1.js
http://localhost:3000/apis/dashboard.grafana.app/
http://localhost:3000/public/fonts/inter/Inter-Medium.woff2
http://localhost:3000/apis/collections.grafana.app/v1alpha1/namespaces/default/stars?fieldSelector=metadata.name%3Duser-
http://localhost:3000/apis/dashboard.grafana.app/v2/namespaces/default/dashboards/fdvnajo8la5mob/dto
http://localhost:3000/api/prometheus/grafana/api/v1/rules?dashboard_uid=fdvnajo8la5mob
http://localhost:3000/public/build/alert-rules-toolbar-button.67fb7fc6956d833ad48e.js
http://localhost:3000/public/build/grafanaPlugin.52f017f1f44e13384ef7.js
http://localhost:3000/api/annotations?from=1790297905325&to=1790319505325&limit=100&matchAny=false&dashboardUID=fdvnajo8la5mob
http://localhost:3000/api/prometheus/grafana/api/v1/rules?dashboard_uid=fdvnajo8la5mob
`,
};
