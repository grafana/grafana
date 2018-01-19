#!/bin/bash

if [ -z $1 ]; then
  echo Usage: $0 LANGUAGE
  echo Re-list all failures of a specific LANGUAGE into known_failures_Linux.json
  echo LANGUAGE should be library name like cpp, java, py etc
  exit 1
fi

if [ -z $PYTHON]; then
  PYTHON=python
fi

TARGET_LANG=$1
OUT_FILE=known_failures_Linux.json
echo Rebuilding known failures for $TARGET_LANG

TMPFILE=.__tmp__rebuild__
grep -v -e "\"$1-" -e "\-$1_" $OUT_FILE > $TMPFILE
mv $TMPFILE $OUT_FILE
$PYTHON test.py --client $1
$PYTHON test.py -U merge
$PYTHON test.py --server $1
$PYTHON test.py -U merge
