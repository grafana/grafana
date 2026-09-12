export const statsFilter = {
  exclude: /@kusto|monaco-editor|public\/locales/,
  minDominance: 0.75,
  requestUrls: `
http://localhost:3000/d/fdvnajo8la5mob/empty?from=now-6h&to=now&timezone=browser
http://localhost:3000/public/build/grafana.app.e3d0bb45757bd985dc70.css
http://localhost:3000/public/build/grafana.dark.04cc15f4008a63621333.css
http://localhost:3000/public/build/runtime.cc8610004018df7ffe91.js
http://localhost:3000/public/build/6095.c47ef6d577f1bd831737.js
http://localhost:3000/public/build/73142.2d902e061f11e62c6ff1.js
http://localhost:3000/public/build/app.0f7e13c164c6f4cfac8a.js
http://localhost:3000/public/build/img/grafana_icon.svg
http://localhost:3000/apis/features.grafana.app/v0alpha1/namespaces/default/ofrep/v1/evaluate/flags
http://localhost:3000/public/build/71266.c3f1559e096f5f149bc1.js
http://localhost:3000/public/build/img/fav32.png
ws://localhost:3000/api/live/ws
http://localhost:3000/api/plugins/grafana-exploretraces-app/settings
http://localhost:3000/api/plugins/grafana-lokiexplore-app/settings
http://localhost:3000/api/plugins/grafana-metricsdrilldown-app/settings
http://localhost:3000/api/plugins/grafana-pyroscope-app/settings
http://localhost:3000/public/build/73809.86d2b5f4453780844abc.js
http://localhost:3000/public/build/26813.22ddd3bef11ce76d8a7c.js
http://localhost:3000/public/build/30668.06f5f3879fbd4791bd76.js
http://localhost:3000/public/build/96893.9ba8a02b1760520e49f5.js
http://localhost:3000/public/build/DashboardPageProxy.89aa2d09dbb93c5061e8.js
http://localhost:3000/public/build/static/img/grafana_icon.1e0deb6b.svg
http://localhost:3000/public/fonts/inter/Inter-Regular.woff2
http://localhost:3000/public/plugins/grafana-exploretraces-app/module.js?_cache=2.2.0
http://localhost:3000/public/plugins/grafana-lokiexplore-app/module.js?_cache=2.5.2
http://localhost:3000/public/plugins/grafana-metricsdrilldown-app/module.js?_cache=2.5.1
http://localhost:3000/public/plugins/grafana-pyroscope-app/module.js?_cache=2.3.0
http://localhost:3000/public/build/1044.e0b528d98cc1b4be9bd9.js
http://localhost:3000/public/build/54251.73c80cf29319e99d860e.js
http://localhost:3000/public/build/48122.d65f442072798e402a94.js
http://localhost:3000/apis/dashboard.grafana.app/
http://localhost:3000/public/fonts/inter/Inter-Medium.woff2
http://localhost:3000/apis/collections.grafana.app/v1alpha1/namespaces/default/stars?fieldSelector=metadata.name%3Duser-
http://localhost:3000/apis/dashboard.grafana.app/v2/namespaces/default/dashboards/fdvnajo8la5mob/dto
http://localhost:3000/api/prometheus/grafana/api/v1/rules?dashboard_uid=fdvnajo8la5mob
http://localhost:3000/public/build/alert-rules-toolbar-button.67fb7fc6956d833ad48e.js
http://localhost:3000/public/build/grafanaPlugin.8a4efb539f1cda02addb.js
http://localhost:3000/api/annotations?from=1789166242623&to=1789187842623&limit=100&matchAny=false&dashboardUID=fdvnajo8la5mob
http://localhost:3000/public/build/img/icons/unicons/spinner.svg
http://localhost:3000/api/prometheus/grafana/api/v1/rules?dashboard_uid=fdvnajo8la5mob
http://localhost:3000/api/frontend-metrics
`,
};
