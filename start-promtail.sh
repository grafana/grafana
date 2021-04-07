docker run --rm --name promtail --volume "/etc/promtail:/etc/promtail" --volume "/var/log:/var/log" grafana/promtail:master -config.file=/etc/promtail/config.yaml
