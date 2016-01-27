#/bin/bash

#ln -s -f .hooks/* .git/hooks/
cd .git/hooks/
cp --symbolic-link -f ../../.hooks/* .
