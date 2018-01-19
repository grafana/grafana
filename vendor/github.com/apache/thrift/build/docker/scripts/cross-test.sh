#!/bin/sh
set -ev

./bootstrap.sh
./configure --enable-tutorial=no
make -j3 precross

set +e
make cross$1

RET=$?
if [ $RET -ne 0 ]; then
  cat test/log/unexpected_failures.log
fi

exit $RET
