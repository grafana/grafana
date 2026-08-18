export const statsFilter = {
  exclude: /@kusto|monaco-editor|public\/locales/,
  minDominance: 0.75,
  requestUrls: `
http://localhost:3000/d/fdvnajo8la5mob/empty?orgId=1&from=now-6h&to=now&timezone=browser
http://localhost:3000/public/build/grafana.app.e3d0bb45757bd985dc70.css
http://localhost:3000/public/build/grafana.dark.2ecc710216772a806751.css
http://localhost:3000/public/build/runtime.6ce30cb5cdf5c5af89bd.js
http://localhost:3000/public/build/6029.ced17922ce65e4fd1ef9.js
http://localhost:3000/public/build/7936.e48a9c40d61cb800c1d8.js
http://localhost:3000/public/build/6540.3fc158aa191c16b10418.js
http://localhost:3000/public/build/app.22947a30f90dec2d1804.js
http://localhost:3000/public/build/img/grafana_icon.svg
http://localhost:3000/public/build/1266.cec301e7ad1914cdd971.js
ws://localhost:3000/api/live/ws
http://localhost:3000/api/plugins/grafana-exploretraces-app/settings
http://localhost:3000/api/plugins/grafana-lokiexplore-app/settings
http://localhost:3000/api/plugins/grafana-metricsdrilldown-app/settings
http://localhost:3000/api/plugins/grafana-pyroscope-app/settings
http://localhost:3000/public/build/3809.4bf7bbf744f7914f9c00.js
http://localhost:3000/public/build/6813.88ccab23ac3399ad228e.js
http://localhost:3000/public/build/6594.4dbf722e0b623ddad497.js
http://localhost:3000/public/build/3340.392d81b501dc9ee4fc46.js
http://localhost:3000/public/build/DashboardPageProxy.4b7715f23e52c31772ea.js
http://localhost:3000/public/build/static/img/grafana_icon.1e0deb6b.svg
http://localhost:3000/public/fonts/inter/Inter-Regular.woff2
http://localhost:3000/public/plugins/grafana-pyroscope-app/module.js?_cache=2.2.0
http://localhost:3000/public/plugins/grafana-lokiexplore-app/module.js?_cache=2.5.1
http://localhost:3000/public/plugins/grafana-exploretraces-app/module.js?_cache=2.1.0
http://localhost:3000/public/plugins/grafana-metricsdrilldown-app/module.js?_cache=2.5.0
http://localhost:3000/public/build/1044.e0b528d98cc1b4be9bd9.js
http://localhost:3000/public/build/4251.961875e772f40899a7b9.js
http://localhost:3000/public/build/8122.61095200e50de51fc7f7.js
http://localhost:3000/public/build/img/fav32.png
http://localhost:3000/apis/dashboard.grafana.app/
http://localhost:3000/public/fonts/inter/Inter-Medium.woff2
http://localhost:3000/apis/dashboard.grafana.app/v2/namespaces/default/dashboards/fdvnajo8la5mob/dto
http://localhost:3000/api/prometheus/grafana/api/v1/rules?dashboard_uid=fdvnajo8la5mob
http://localhost:3000/public/build/alert-rules-toolbar-button.301eecafdf8a9d746888.js
http://localhost:3000/public/build/grafanaPlugin.31b6ff5080f7874b91f7.js
http://localhost:3000/api/annotations?from=1787038682447&to=1787060282447&limit=100&matchAny=false&dashboardUID=fdvnajo8la5mob
http://localhost:3000/api/frontend-metrics
chrome-extension://eab7272a-a5d3-4e28-a2ea-fea8cc9f8a50/web_accessible_resources/noop.txt
chrome-extension://hnmpcagpplmpfojmgmnngilcnanddlhb/web_accessible_resources/noop.txt
`,
};
