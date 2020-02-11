FROM centos

ARG REPO_CONFIG=grafana.repo.oss
ARG PACKAGE=grafana

COPY "./$REPO_CONFIG" /etc/yum.repos.d/grafana.repo

RUN yum install -y $PACKAGE
