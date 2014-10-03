docker kill rethinkdb
docker rm rethinkdb

docker run -d -p 8180:8080 -p 28015:28015 -p 29015:29015 \
  --name rethinkdb \
  -v /var/docker/grafana-pro-rethinkdb:/data \
  dockerfile/rethinkdb
