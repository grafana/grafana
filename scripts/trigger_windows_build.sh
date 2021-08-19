#!/bin/bash

_token=$1
_commit=$2
_buildType=$3

post_data=$(cat <<EOF
{
  "accountName": "Torkeldegaard",
  "projectSlug": "grafana",
  "branch": "main",
  "commitId": "${_commit}",
  "environmentVariables": {
    "buildType": "${_buildType}"
  }
}
EOF
)

echo "${post_data}"

curl \
--header "Accept: application/json" \
--header "Content-Type: application/json" \
--header "Authorization: Bearer ${_token}" \
--data "${post_data}" \
--request POST https://ci.appveyor.com/api/builds
