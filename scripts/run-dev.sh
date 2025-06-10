#!/bin/bash -e

PERMISSIONS_OK=0

if [ ! -r "$GF_PATHS_CONFIG" ]; then
    echo "GF_PATHS_CONFIG='$GF_PATHS_CONFIG' is not readable."
    PERMISSIONS_OK=1
fi

if [ ! -w "$GF_PATHS_DATA" ]; then
    echo "GF_PATHS_DATA='$GF_PATHS_DATA' is not writable."
    PERMISSIONS_OK=1
fi

if [ ! -r "$GF_PATHS_HOME" ]; then
    echo "GF_PATHS_HOME='$GF_PATHS_HOME' is not readable."
    PERMISSIONS_OK=1
fi

if [ $PERMISSIONS_OK -eq 1 ]; then
    echo "You may have issues with file permissions, more information here: http://docs.grafana.org/installation/docker/#migrate-to-v51-or-later"
fi

if [ ! -d "$GF_PATHS_PLUGINS" ]; then
    mkdir "$GF_PATHS_PLUGINS"
fi

export HOME="$GF_PATHS_HOME"

echo "Starting Grafana in development mode..."
echo "Static files will be served from: $GF_PATHS_HOME/public"
echo "Build files directory: $GF_PATHS_HOME/public/build"

# Check if build directory exists and has files
if [ -d "$GF_PATHS_HOME/public/build" ] && [ "$(ls -A $GF_PATHS_HOME/public/build)" ]; then
    echo "✓ Build files found in public/build directory"
    ls -la "$GF_PATHS_HOME/public/build" | head -5
else
    echo "⚠ WARNING: No build files found in public/build directory"
    echo "Make sure 'yarn start' is running and has completed initial build"
fi

# Start Grafana in development mode (similar to make run-go)
exec grafana server                                         \
  --homepath="$GF_PATHS_HOME"                               \
  --config="$GF_PATHS_CONFIG"                               \
  --packaging=dev                                           \
  "$@"                                                      \
  cfg:app_mode=development                                  \
  cfg:default.log.mode="console"                            \
  cfg:default.log.level="debug"                             \
  cfg:default.paths.data="$GF_PATHS_DATA"                   \
  cfg:default.paths.logs="$GF_PATHS_LOGS"                   \
  cfg:default.paths.plugins="$GF_PATHS_PLUGINS"             \
  cfg:default.paths.provisioning="$GF_PATHS_PROVISIONING" 