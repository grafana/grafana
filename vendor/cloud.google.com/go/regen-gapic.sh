#!/bin/bash

# This script generates all GAPIC clients in this repo.
# One-time setup:
#   cd path/to/googleapis # https://github.com/googleapis/googleapis
#   virtualenv env
#   . env/bin/activate
#   pip install googleapis-artman
#   deactivate
#
# Regenerate:
#   cd path/to/googleapis
#   . env/bin/activate
#   $GOPATH/src/cloud.google.com/go/regen-gapic.sh
#   deactivate
#
# Being in googleapis directory is important;
# that's where we find YAML files and where artman puts the "artman-genfiles" directory.
#
# NOTE: This script does not generate the "raw" gRPC client found in google.golang.org/genproto.
# To do that, use the regen.sh script in the genproto repo instead.

set -ex

APIS=(
google/cloud/bigquery/datatransfer/artman_bigquerydatatransfer.yaml
google/cloud/dataproc/artman_dataproc_v1.yaml
google/cloud/language/artman_language_v1.yaml
google/cloud/language/artman_language_v1beta2.yaml
google/cloud/oslogin/artman_oslogin_v1beta.yaml
google/cloud/speech/artman_speech_v1.yaml
google/cloud/speech/artman_speech_v1beta1.yaml
google/cloud/videointelligence/artman_videointelligence_v1beta1.yaml
google/cloud/videointelligence/artman_videointelligence_v1beta2.yaml
google/cloud/vision/artman_vision_v1.yaml
google/cloud/vision/artman_vision_v1p1beta1.yaml
google/container/artman_container.yaml
google/devtools/artman_clouddebugger.yaml
google/devtools/clouderrorreporting/artman_errorreporting.yaml
google/devtools/cloudtrace/artman_cloudtrace_v1.yaml
google/devtools/cloudtrace/artman_cloudtrace_v2.yaml
google/firestore/artman_firestore.yaml
google/logging/artman_logging.yaml
google/longrunning/artman_longrunning.yaml
google/monitoring/artman_monitoring.yaml
google/privacy/dlp/artman_dlp.yaml
google/pubsub/artman_pubsub.yaml
google/spanner/admin/database/artman_spanner_admin_database.yaml
google/spanner/admin/instance/artman_spanner_admin_instance.yaml
google/spanner/artman_spanner.yaml
)

for api in "${APIS[@]}"; do
  rm -rf artman-genfiles/*
  artman2 --config "$api" generate go_gapic
  cp -r artman-genfiles/gapi-*/cloud.google.com/go/* $GOPATH/src/cloud.google.com/go/
done

go list cloud.google.com/go/... | grep apiv | xargs go test

go test -short cloud.google.com/go/...

echo "googleapis version: $(git rev-parse HEAD)"
