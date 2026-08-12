#!/bin/bash

_circle_token=$1

trigger_build_url="https://circleci.com/api/v1/project/grafana/grafana-packer/tree/master?circle-token=${_circle_token}"

curl \
--header "Accept: application/json" \
--header "Content-Type: application/json" \
--request POST "${trigger_build_url}"
