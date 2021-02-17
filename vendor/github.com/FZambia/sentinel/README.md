go-sentinel
===========

Redis Sentinel support for [redigo](https://github.com/gomodule/redigo) library.

Documentation
-------------

- [API Reference](http://godoc.org/github.com/FZambia/sentinel)

Alternative solution
--------------------

You can alternatively configure Haproxy between your application and Redis to proxy requests to Redis master instance if you only need HA:

```
listen redis
    server redis-01 127.0.0.1:6380 check port 6380 check inter 2s weight 1 inter 2s downinter 5s rise 10 fall 2 on-marked-down shutdown-sessions on-marked-up shutdown-backup-sessions
    server redis-02 127.0.0.1:6381 check port 6381 check inter 2s weight 1 inter 2s downinter 5s rise 10 fall 2 backup
    bind *:6379
    mode tcp
    option tcpka
    option tcplog
    option tcp-check
    tcp-check send PING\r\n
    tcp-check expect string +PONG
    tcp-check send info\ replication\r\n
    tcp-check expect string role:master
    tcp-check send QUIT\r\n
    tcp-check expect string +OK
    balance roundrobin
```

This way you don't need to use this library.

License
-------

Library is available under the [Apache License, Version 2.0](http://www.apache.org/licenses/LICENSE-2.0.html). 
