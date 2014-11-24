docker build -t gf-pro-image .

docker kill gf-pro
docker rm gf-pro

docker run -d --name="gf-pro" \
             -p 127.0.0.1:5432:5432 \
             -v /var/docker/grafana-pro/postgresql:/var/lib/postgres \
             gf-pro-image
