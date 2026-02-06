#!/usr/bin/env bash

# Taken from https://gist.github.com/soniah/c11633551c6dd84dab66cad20453cfa8
# remove all blank lines in go 'imports' statements, as goimports doesn't do it.

if [ $# != 1 ] ; then
  echo "usage: $0 <filename>"
  exit 1
fi

sed -i '
  /^import/,/)/ {
    /^$/ d
  }
' $1
