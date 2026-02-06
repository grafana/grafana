-- Get presence information.
-- KEYS[1] - presence set key
-- KEYS[2] - presence hash key
-- ARGV[1] - current timestamp in seconds
-- ARGV[2] - use hash field TTL "0" or "1"
if ARGV[2] == '0' then
    local expired = redis.call("zrangebyscore", KEYS[1], "0", ARGV[1])
    if #expired > 0 then
        for num = 1, #expired do
            redis.call("hdel", KEYS[2], expired[num])
        end
        redis.call("zremrangebyscore", KEYS[1], "0", ARGV[1])
    end
end
return redis.call("hgetall", KEYS[2])
