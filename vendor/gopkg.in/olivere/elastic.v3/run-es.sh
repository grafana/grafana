mkdir -p config/scripts
docker run --rm --privileged=true -p 9200:9200 -p 9300:9300 -v "$PWD/config:/usr/share/elasticsearch/config" -e ES_JAVA_OPTS='-Xms1g -Xmx1g' elasticsearch:2.4.3 elasticsearch
