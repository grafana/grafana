-- Add/update presence information.
-- KEYS[1] - presence zset key
-- KEYS[2] - presence hash key
-- KEYS[3] - per-user zset key
-- KEYS[4] - per-user hash key
-- ARGV[1] - key expire seconds
-- ARGV[2] - expire at for set member
-- ARGV[3] - client ID
-- ARGV[4] - info payload
-- ARGV[5] - user ID
-- ARGV[6] - enable user mapping "0" or "1"
-- ARGV[7] - use hash field TTL "0" or "1"

-- Check if client ID is new.
local isNewClient = false
if ARGV[6] ~= '0' then
    isNewClient = redis.call("hexists", KEYS[2], ARGV[3]) == 0
end

-- Add per-client presence.
redis.call("hset", KEYS[2], ARGV[3], ARGV[4])
redis.call("expire", KEYS[2], ARGV[1])
if ARGV[7] == '0' then
    redis.call("zadd", KEYS[1], ARGV[2], ARGV[3])
    redis.call("expire", KEYS[1], ARGV[1])
else
    redis.call("hexpire", KEYS[2], ARGV[1], "FIELDS", "1", ARGV[3])
end

-- Add per-user information.
if ARGV[6] ~= '0' then
    if isNewClient then
        redis.call("hincrby", KEYS[4], ARGV[5], 1)
    end
    redis.call("expire", KEYS[4], ARGV[1])
    if ARGV[7] == '0' then
        redis.call("zadd", KEYS[3], ARGV[2], ARGV[5])
        redis.call("expire", KEYS[3], ARGV[1])
    else
        redis.call("hexpire", KEYS[4], ARGV[1], "FIELDS", "1", ARGV[5])
    end
end
