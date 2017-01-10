#!/bin/bash

_circle_token=$1

trigger_build_url=https://circleci.com/api/v1/project/grafana/grafana-packer/tree/v4.1.x?circle-token=${_circle_token}

post_data=$(cat <<EOF
{
  "build_parameters": {
    "BRANCH": "v4.1.x"
  }
}
EOF
)

echo ${post_data}

curl \
--header "Accept: application/json" \
--header "Content-Type: application/json" \
--data "${post_data}" \
--request POST ${trigger_build_url}

#curl \
#--header "Accept: application/json" \
#--header "Content-Type: application/json" \
#-X POST -d '{ "build_parameters": { "BRANCH": "v4.1.x"} }' \
#${trigger_build_url}

#--request POST ${trigger_build_url}


