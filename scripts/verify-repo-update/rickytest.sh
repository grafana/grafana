#!/usr/bin/env bash

CHECK_BETA=false;
if [ "$#" = 1 ]; then
    echo 1 param
elif [ "$#" = 2 ]; then
    echo 2 param
    CHECK_BETA=true;
fi


echo $CHECK_BETA
if [ $CHECK_BETA == true ]; then
  echo "TRUE!"
fi
