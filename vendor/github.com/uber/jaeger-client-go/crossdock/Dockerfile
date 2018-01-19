FROM scratch

ADD crossdock /

ENV AGENT_HOST_PORT=jaeger-agent:5775
ENV SAMPLING_SERVER_URL=http://test_driver:5778/sampling

EXPOSE 8080-8082

CMD ["/crossdock"]
