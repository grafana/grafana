export const statsFilter = {
  exclude: /@kusto|monaco-editor|public\/locales/,
  minDominance: 0.75,
  requestUrls: `
http://localhost:3000/d/fdvnajo8la5mob/empty?orgId=1&from=now-6h&to=now&timezone=browser
http://localhost:3000/public/build/grafana.app.e3d0bb45757bd985dc70.css
http://localhost:3000/public/build/grafana.dark.2ecc710216772a806751.css
http://localhost:3000/public/build/runtime.4997b6e40cfa2b001357.js
http://localhost:3000/public/build/8274.4ced89581a78e23686c4.js
http://localhost:3000/public/build/7522.a74c40b6989470c21c89.js
http://localhost:3000/public/build/app.cfb736af663714673bc6.js
http://localhost:3000/public/build/img/grafana_icon.svg
http://localhost:3000/public/build/1266.cec301e7ad1914cdd971.js
ws://localhost:3000/api/live/ws
http://localhost:3000/api/plugins/grafana-exploretraces-app/settings
http://localhost:3000/api/plugins/grafana-lokiexplore-app/settings
http://localhost:3000/api/plugins/grafana-metricsdrilldown-app/settings
http://localhost:3000/api/plugins/grafana-pyroscope-app/settings
http://localhost:3000/public/build/3809.dcca0cf26613ebe927ae.js
http://localhost:3000/public/build/6813.e8dd24cc92d923d168ca.js
http://localhost:3000/public/build/668.d92704d439aff2acc6bd.js
http://localhost:3000/public/build/3340.6010915f7fa3ecdff0ac.js
http://localhost:3000/public/build/DashboardPageProxy.4b7715f23e52c31772ea.js
http://localhost:3000/public/build/static/img/grafana_icon.1e0deb6b.svg
http://localhost:3000/public/fonts/inter/Inter-Regular.woff2
http://localhost:3000/public/plugins/grafana-exploretraces-app/module.js?_cache=2.1.0
http://localhost:3000/public/plugins/grafana-metricsdrilldown-app/module.js?_cache=2.5.0
http://localhost:3000/public/plugins/grafana-lokiexplore-app/module.js?_cache=2.5.1
http://localhost:3000/public/plugins/grafana-pyroscope-app/module.js?_cache=2.2.0
http://localhost:3000/public/build/1044.e0b528d98cc1b4be9bd9.js
http://localhost:3000/public/build/4251.961875e772f40899a7b9.js
http://localhost:3000/public/build/8122.61095200e50de51fc7f7.js
http://localhost:3000/apis/dashboard.grafana.app/
http://localhost:3000/public/fonts/inter/Inter-Medium.woff2
http://localhost:3000/apis/dashboard.grafana.app/v2/namespaces/default/dashboards/fdvnajo8la5mob/dto
http://localhost:3000/public/build/img/fav32.png
http://localhost:3000/api/prometheus/grafana/api/v1/rules?dashboard_uid=fdvnajo8la5mob
http://localhost:3000/public/build/alert-rules-toolbar-button.0995db38203388962e93.js
http://localhost:3000/public/build/grafanaPlugin.60c54909e4a11eae030a.js
http://localhost:3000/api/annotations?from=1787316628002&to=1787338228002&limit=100&matchAny=false&dashboardUID=fdvnajo8la5mob
http://localhost:3000/public/build/img/icons/unicons/spinner.svg
http://localhost:3000/api/frontend-metrics
chrome-extension://d7922584-7da3-411d-a699-47f94a7b6b71/web_accessible_resources/noop.txt
chrome-extension://hnmpcagpplmpfojmgmnngilcnanddlhb/web_accessible_resources/noop.txt
`,
};
