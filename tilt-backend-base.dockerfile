FROM ubuntu:24.04

RUN apt-get update && apt-get install -y ca-certificates tzdata

WORKDIR /grafana

RUN mkdir -p "conf/provisioning/datasources" \
"conf/provisioning/dashboards" \
"conf/provisioning/notifiers" \
"conf/provisioning/plugins" \
"conf/provisioning/access-control" \
"conf/provisioning/alerting"

# Create a minimal assets-manifest.json for development
RUN mkdir -p public/build
RUN echo '{\
  "entrypoints": {\
    "app": {\
      "assets": {\
        "js": ["public/build/app.js"],\
        "css": ["public/build/grafana.app.css"]\
      }\
    },\
    "dark": {\
      "assets": {\
        "css": ["public/build/grafana.dark.css"]\
      }\
    },\
    "light": {\
      "assets": {\
        "css": ["public/build/grafana.light.css"]\
      }\
    }\
  }\
}' > public/build/assets-manifest.json
RUN echo 'window.alert("Using fake assets instead of CDN")' > public/build/app.js

COPY tilt-build-run-grafana.sh .

EXPOSE 3000

ENTRYPOINT ["sh", "tilt-build-run-grafana.sh"]
