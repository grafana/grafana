#!/bin/sh
set -ev

dpkg-buildpackage -tc -us -uc
ls -al ..
