export const statsFilter = {
  exclude: /@kusto|monaco-editor|public\/locales/,
  minDominance: 0.75,
  requestUrls: `
http://localhost:3000/d/fdvnajo8la5mob/empty?from=now-6h&to=now&timezone=browser
http://localhost:3000/public/build/grafana.app.c136aec3009e6d4616bc.css
http://localhost:3000/public/build/grafana.dark.2ecc710216772a806751.css
http://localhost:3000/public/build/runtime.671bfc214380f6767193.js
http://localhost:3000/public/build/14604.d8be1262e82cc0d29fec.js
http://localhost:3000/public/build/73142.9fbe2814432e3d5f112f.js
http://localhost:3000/public/build/app.391ade5b2c2a63264fed.js
http://localhost:3000/public/build/img/grafana_icon.svg
http://localhost:3000/public/build/71266.c3f1559e096f5f149bc1.js
ws://localhost:3000/api/live/ws
http://localhost:3000/api/plugins/grafana-exploretraces-app/settings
http://localhost:3000/api/plugins/grafana-lokiexplore-app/settings
http://localhost:3000/api/plugins/grafana-metricsdrilldown-app/settings
http://localhost:3000/api/plugins/grafana-pyroscope-app/settings
http://localhost:3000/public/plugins/grafana-exploretraces-app/module.js?_cache=2.2.0
http://localhost:3000/public/plugins/grafana-lokiexplore-app/module.js?_cache=2.5.2
http://localhost:3000/public/build/3340.bb7cef6aa14a3e731d33.js
http://localhost:3000/public/build/DashboardPageProxy.5bbb7abd20cdc2baca2d.js
http://localhost:3000/public/build/static/img/grafana_icon.1e0deb6b.svg
http://localhost:3000/public/plugins/grafana-metricsdrilldown-app/module.js?_cache=2.5.1
http://localhost:3000/public/build/img/fav32.png
http://localhost:3000/public/plugins/grafana-pyroscope-app/module.js?_cache=2.3.0
http://localhost:3000/public/build/1044.e0b528d98cc1b4be9bd9.js
http://localhost:3000/public/build/68028.fc9c74f50e79431c13f6.js
http://localhost:3000/public/build/48122.d65f442072798e402a94.js
http://localhost:3000/apis/dashboard.grafana.app/
http://localhost:3000/public/fonts/inter/Inter-Medium.woff2
http://localhost:3000/public/fonts/inter/Inter-Regular.woff2
http://localhost:3000/apis/collections.grafana.app/v1alpha1/namespaces/default/stars?fieldSelector=metadata.name%3Duser-
http://localhost:3000/apis/dashboard.grafana.app/v2/namespaces/default/dashboards/fdvnajo8la5mob/dto
http://localhost:3000/api/prometheus/grafana/api/v1/rules?dashboard_uid=fdvnajo8la5mob
http://localhost:3000/public/build/alert-rules-toolbar-button.67fb7fc6956d833ad48e.js
http://localhost:3000/public/build/grafanaPlugin.8a4efb539f1cda02addb.js
http://localhost:3000/api/annotations?from=1787947885302&to=1787969485302&limit=100&matchAny=false&dashboardUID=fdvnajo8la5mob
http://localhost:3000/api/prometheus/grafana/api/v1/rules?dashboard_uid=fdvnajo8la5mob
http://localhost:3000/api/frontend-metrics
`,
};
