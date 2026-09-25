export const statsFilter = {
  exclude: /@kusto|monaco-editor|public\/locales/,
  minDominance: 0.75,
  requestUrls: `
http://localhost:3000/d/fdvnajo8la5mob/empty?from=now-6h&to=now&timezone=browser
http://localhost:3000/public/build/grafana.app.65cff3b3a422b680b421.css
http://localhost:3000/public/build/grafana.dark.04cc15f4008a63621333.css
http://localhost:3000/public/build/runtime.8c8d4046c1844a51afab.js
http://localhost:3000/public/build/40593.1a74e7adc2958328bbb8.js
http://localhost:3000/public/build/97301.8476c890e57c3e23a08e.js
http://localhost:3000/public/build/app.e3b4474c6b0bb0e7e001.js
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
http://localhost:3000/public/build/96893.5bca5d4bcfa3b76860de.js
http://localhost:3000/public/build/DashboardPageProxy.803314d70c4dcda02bb5.js
http://localhost:3000/public/build/static/img/grafana_icon.1e0deb6b.svg
http://localhost:3000/public/plugins/grafana-exploretraces-app/module.js?_cache=2.2.1
http://localhost:3000/public/plugins/grafana-lokiexplore-app/module.js?_cache=2.6.0
http://localhost:3000/public/plugins/grafana-pyroscope-app/module.js?_cache=2.3.1
http://localhost:3000/public/plugins/grafana-metricsdrilldown-app/module.js?_cache=2.5.1
http://localhost:3000/public/build/1044.e0b528d98cc1b4be9bd9.js
http://localhost:3000/public/build/22100.858a2e5c53c2b2c14b85.js
http://localhost:3000/public/build/20472.59c46f916ff48712d4d1.js
http://localhost:3000/public/build/49812.ff8d3f851538b59d778a.js
http://localhost:3000/apis/dashboard.grafana.app/
http://localhost:3000/public/fonts/inter/Inter-Medium.woff2
http://localhost:3000/apis/dashboard.grafana.app/v2/namespaces/default/dashboards/fdvnajo8la5mob/dto
http://localhost:3000/api/prometheus/grafana/api/v1/rules?dashboard_uid=fdvnajo8la5mob
http://localhost:3000/public/build/alert-rules-toolbar-button.67fb7fc6956d833ad48e.js
http://localhost:3000/public/build/50919.2b441c550a83f4b8c42d.js
http://localhost:3000/public/build/grafanaPlugin.41ad16227ef266addd16.js
http://localhost:3000/api/annotations?from=1790300193187&to=1790321793187&limit=100&matchAny=false&dashboardUID=fdvnajo8la5mob
http://localhost:3000/api/prometheus/grafana/api/v1/rules?dashboard_uid=fdvnajo8la5mob
`,
};
