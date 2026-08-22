export const statsFilter = {
  exclude: /@kusto|monaco-editor|public\/locales/,
  minDominance: 0.75,
  requestUrls: `
http://localhost:3000/d/fdvnajo8la5mob/empty?orgId=1&from=now-6h&to=now&timezone=browser&chunkNotFound=true
http://localhost:3000/public/build/grafana.app.e3d0bb45757bd985dc70.css
http://localhost:3000/public/build/grafana.dark.2ecc710216772a806751.css
http://localhost:3000/public/build/runtime.276722af56cd2e8ba038.js
http://localhost:3000/public/build/38090.2b2e35daf089ada4927f.js
http://localhost:3000/public/build/37522.5de9711f4b65e1caf037.js
http://localhost:3000/public/build/app.3271cdfbd17f3fddb7db.js
http://localhost:3000/public/build/img/grafana_icon.svg
http://localhost:3000/public/build/71266.c3f1559e096f5f149bc1.js
ws://localhost:3000/api/live/ws
http://localhost:3000/api/plugins/grafana-exploretraces-app/settings
http://localhost:3000/api/plugins/grafana-lokiexplore-app/settings
http://localhost:3000/api/plugins/grafana-metricsdrilldown-app/settings
http://localhost:3000/api/plugins/grafana-pyroscope-app/settings
http://localhost:3000/public/build/73809.71d3164647f60f7d9c5b.js
http://localhost:3000/public/build/26813.22ddd3bef11ce76d8a7c.js
http://localhost:3000/public/build/30668.b2ea9562363d7fed83cc.js
http://localhost:3000/public/build/3340.6010915f7fa3ecdff0ac.js
http://localhost:3000/public/build/DashboardPageProxy.ec9aa87a2c80a7cb28f4.js
http://localhost:3000/public/build/static/img/grafana_icon.1e0deb6b.svg
http://localhost:3000/public/fonts/inter/Inter-Regular.woff2
http://localhost:3000/public/build/img/fav32.png
http://localhost:3000/public/plugins/grafana-exploretraces-app/module.js?_cache=2.1.0
http://localhost:3000/public/plugins/grafana-metricsdrilldown-app/module.js?_cache=2.5.0
http://localhost:3000/public/plugins/grafana-pyroscope-app/module.js?_cache=2.2.0
http://localhost:3000/public/plugins/grafana-lokiexplore-app/module.js?_cache=2.5.1
http://localhost:3000/public/build/1044.e0b528d98cc1b4be9bd9.js
http://localhost:3000/public/build/54251.73c80cf29319e99d860e.js
http://localhost:3000/public/build/48122.d65f442072798e402a94.js
http://localhost:3000/apis/dashboard.grafana.app/
http://localhost:3000/public/fonts/inter/Inter-Medium.woff2
http://localhost:3000/apis/collections.grafana.app/v1alpha1/namespaces/default/stars?fieldSelector=metadata.name%3Duser-
http://localhost:3000/apis/dashboard.grafana.app/v2/namespaces/default/dashboards/fdvnajo8la5mob/dto
http://localhost:3000/api/prometheus/grafana/api/v1/rules?dashboard_uid=fdvnajo8la5mob
http://localhost:3000/api/prometheus/grafana/api/v1/rules?dashboard_uid=fdvnajo8la5mob
http://localhost:3000/public/build/grafanaPlugin.434f3f03f0788ac465dd.js
http://localhost:3000/api/annotations?from=1787335975026&to=1787357575026&limit=100&matchAny=false&dashboardUID=fdvnajo8la5mob
http://localhost:3000/api/frontend-metrics
`,
};
