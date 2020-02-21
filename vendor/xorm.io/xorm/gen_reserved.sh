#!/bin/bash
if [ -f $1 ];then
    cat $1| awk '{printf("\""$1"\":true,\n")}' 
else
    echo "argument $1 if not a file!"
fi
