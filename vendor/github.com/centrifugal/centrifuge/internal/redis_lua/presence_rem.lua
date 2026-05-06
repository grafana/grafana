-- Remove client presence.
-- KEYS[1] - presence set key
-- KEYS[2] - presence hash key
-- KEYS[3] - per-user zset key
-- KEYS[4] - per-user hash key
-- ARGV[1] - client ID
-- ARGV[2] - user ID
-- ARGV[3] - enable user mapping "0" or "1"
-- ARGV[4] - use hash field TTL "0" or "1"

local clientExists = false
if ARGV[3] ~= '0' then
    -- Check if client ID exists in hash.
    clientExists = redis.call("hexists", KEYS[2], ARGV[1]) == 1
end

redis.call("hdel", KEYS[2], ARGV[1])
if ARGV[4] == '0' then
    redis.call("zrem", KEYS[1], ARGV[1])
end

if ARGV[3] ~= '0' and clientExists then
    local connectionsCount = redis.call("hincrby", KEYS[4], ARGV[2], -1)
    -- If the number of connections for this user is zero, remove the user
    -- from the sorted set and clean hash.
    if connectionsCount <= 0 then
        if ARGV[4] == '0' then
            redis.call("zrem", KEYS[3], ARGV[2])
        end
        redis.call("hdel", KEYS[4], ARGV[2])
    end
end
