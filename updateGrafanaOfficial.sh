#!/usr/bin/env bash

if !(git remote | grep origin > /dev/null); then
  git remote add origin git@github.com:adremsoft/NetCrunch-grafana.git
fi

if !(git remote | grep official > /dev/null); then
  git remote add official git@github.com:grafana/grafana.git
fi

git pull official master:grafana-official
git push origin grafana-official:grafana-official
