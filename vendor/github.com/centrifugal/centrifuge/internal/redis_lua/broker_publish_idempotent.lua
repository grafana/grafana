local result_key = KEYS[1]
local payload = ARGV[1]
local channel = ARGV[2]
local publish_command = ARGV[3]
local result_key_expire = ARGV[4]

if result_key_expire ~= '' then
    local stream_meta = redis.call("hmget", result_key, "e", "s")
    local result_epoch, result_offset = stream_meta[1], stream_meta[2]
    if result_epoch ~= false then
        return { result_offset, result_epoch }
    end
end

local res
if channel ~= '' then
    res = redis.call(publish_command, channel, payload)
end

if result_key_expire ~= '' then
    redis.call("hset", result_key, "e", "")
    redis.call("expire", result_key, result_key_expire)
end

return res
