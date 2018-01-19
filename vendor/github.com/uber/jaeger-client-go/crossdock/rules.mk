XDOCK_YAML=crossdock/docker-compose.yml

JAEGER_COMPOSE_URL=https://raw.githubusercontent.com/jaegertracing/jaeger/master/docker-compose/jaeger-docker-compose.yml
XDOCK_JAEGER_YAML=crossdock/jaeger-docker-compose.yml

.PHONY: crossdock-linux-bin
crossdock-linux-bin:
	CGO_ENABLED=0 GOOS=linux time go build -a -installsuffix cgo -o crossdock/crossdock ./crossdock

.PHONY: crossdock
crossdock: crossdock-linux-bin crossdock-download-jaeger
	docker-compose -f $(XDOCK_YAML) -f $(XDOCK_JAEGER_YAML) kill go
	docker-compose -f $(XDOCK_YAML) -f $(XDOCK_JAEGER_YAML) rm -f go
	docker-compose -f $(XDOCK_YAML) -f $(XDOCK_JAEGER_YAML) build go
	docker-compose -f $(XDOCK_YAML) -f $(XDOCK_JAEGER_YAML) run crossdock 2>&1 | tee run-crossdock.log
	grep 'Tests passed!' run-crossdock.log

.PHONY: crossdock-fresh
crossdock-fresh: crossdock-linux-bin crossdock-download-jaeger
	docker-compose -f $(XDOCK_JAEGER_YAML) -f $(XDOCK_YAML) kill
	docker-compose -f $(XDOCK_JAEGER_YAML) -f $(XDOCK_YAML) rm --force
	docker-compose -f $(XDOCK_JAEGER_YAML) -f $(XDOCK_YAML) pull
	docker-compose -f $(XDOCK_JAEGER_YAML) -f $(XDOCK_YAML) build
	docker-compose -f $(XDOCK_JAEGER_YAML) -f $(XDOCK_YAML) run crossdock

.PHONE: crossdock-logs
crossdock-logs: crossdock-download-jaeger
	docker-compose -f $(XDOCK_JAEGER_YAML) -f $(XDOCK_YAML) logs

.PHONY: crossdock-download-jaeger
crossdock-download-jaeger:
	curl -o $(XDOCK_JAEGER_YAML) $(JAEGER_COMPOSE_URL)
