local list_key = KEYS[1]
local meta_key = KEYS[2]
local result_key = KEYS[3]
local message_payload = ARGV[1]
local ltrim_right_bound = ARGV[2]
local list_ttl = ARGV[3]
local channel = ARGV[4]
local meta_expire = ARGV[5]
local new_epoch_if_empty = ARGV[6]
local publish_command = ARGV[7]
local result_key_expire = ARGV[8]
local use_delta = ARGV[9]

if result_key_expire ~= '' then
    local cached_result = redis.call("hmget", result_key, "e", "s")
    local result_epoch, result_offset = cached_result[1], cached_result[2]
    if result_epoch ~= false then
        return { result_offset, result_epoch, "1" }
    end
end

local current_epoch = redis.call("hget", meta_key, "e")
if current_epoch == false then
    current_epoch = new_epoch_if_empty
    redis.call("hset", meta_key, "e", current_epoch)
end

local top_offset = redis.call("hincrby", meta_key, "s", 1)

if meta_expire ~= '0' then
    redis.call("expire", meta_key, meta_expire)
end

local prev_message_payload = ""
if use_delta == "1" then
    prev_message_payload = redis.call("lindex", list_key, 0) or ""
end

local payload = "__" .. "p1:" .. top_offset .. ":" .. current_epoch .. "__" .. message_payload
redis.call("lpush", list_key, payload)
redis.call("ltrim", list_key, 0, ltrim_right_bound)
redis.call("expire", list_key, list_ttl)

if channel ~= '' then
    if use_delta == "1" then
        payload = "__" ..
        "d1:" ..
        top_offset ..
        ":" ..
        current_epoch ..
        ":" .. #prev_message_payload .. ":" .. prev_message_payload .. ":" .. #message_payload .. ":" .. message_payload
    end
    redis.call(publish_command, channel, payload)
end

if result_key_expire ~= '' then
    redis.call("hset", result_key, "e", current_epoch, "s", top_offset)
    redis.call("expire", result_key, result_key_expire)
end

return { top_offset, current_epoch, "0" }
