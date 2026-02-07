local stream_key = KEYS[1]
local meta_key = KEYS[2]
local result_key = KEYS[3]
local message_payload = ARGV[1]
local stream_size = ARGV[2]
local stream_ttl = ARGV[3]
local channel = ARGV[4]
local meta_expire = ARGV[5]
local new_epoch_if_empty = ARGV[6]
local publish_command = ARGV[7]
local result_key_expire = ARGV[8]
local use_delta = ARGV[9]
local version = ARGV[10]
local version_epoch = ARGV[11]

if result_key_expire ~= '' then
    local cached_result = redis.call("hmget", result_key, "e", "s")
    local result_epoch, result_offset = cached_result[1], cached_result[2]
    if result_epoch ~= false then
        return { result_offset, result_epoch, "1", "0" }
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

if version ~= "0" then
    local prev_version_values = redis.call("hmget", meta_key, "v", "ve")
    local prev_version = prev_version_values[1]
    local prev_version_epoch = prev_version_values[2]
    if prev_version then
        if (version_epoch == "" or version_epoch == prev_version_epoch) and (tonumber(prev_version) >= tonumber(version)) then
            return { top_offset, current_epoch, "0", "1" }
        end
    end
    redis.call("hset", meta_key, "v", version, "ve", version_epoch)
end

local prev_message_payload = ""
if use_delta == "1" and top_offset ~= 1 then
    local prev_entries = redis.call("xrevrange", stream_key, "+", "-", "COUNT", 1)
    if #prev_entries > 0 then
        prev_message_payload = prev_entries[1][2]["d"]
        local fields_and_values = prev_entries[1][2]
        -- Loop through the fields and values to find the field "d"
        for i = 1, #fields_and_values, 2 do
            local field = fields_and_values[i]
            local value = fields_and_values[i + 1]
            if field == "d" then
                prev_message_payload = value
                break -- Stop the loop once we find the field "d"
            end
        end
    end
end

if top_offset == 1 then
    -- If a new epoch starts (thus top_offset is 1), try to delete the existing stream, this may
    -- be important when the meta key is evicted by Redis LRU/LFU strategies. So we are emulating
    -- an eviction of stream key here.
    redis.call("del", stream_key)
    prev_message_payload = ""
end

redis.call("xadd", stream_key, "MAXLEN", stream_size, top_offset, "d", message_payload)
redis.call("expire", stream_key, stream_ttl)

if channel ~= '' then
    local payload
    if use_delta == "1" then
        payload = "__" ..
        "d1:" ..
        top_offset ..
        ":" ..
        current_epoch ..
        ":" .. #prev_message_payload .. ":" .. prev_message_payload .. ":" .. #message_payload .. ":" .. message_payload
    else
        payload = "__" .. "p1:" .. top_offset .. ":" .. current_epoch .. "__" .. message_payload
    end
    redis.call(publish_command, channel, payload)
end

if result_key_expire ~= '' then
    redis.call("hset", result_key, "e", current_epoch, "s", top_offset)
    redis.call("expire", result_key, result_key_expire)
end

return { top_offset, current_epoch, "0", "0" }
