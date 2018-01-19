#!/bin/bash

THRIFT_COMPILER=./thrift
OUTPUT_FOLDER=$PWD

if [ ! -e "${THRIFT_COMPILER}" ]
then
   THRIFT_COMPILER=thrift
   command -v  ${THRIFT_COMPILER} >/dev/null 2>&1
   if [ $? -eq 1 ]; then
      echo
      echo "thrift compiler not found."
      echo
      exit
   fi
fi

${THRIFT_COMPILER} --gen cpp Sample.thrift

echo
echo "Files have been generated in gen-cpp."

exit

