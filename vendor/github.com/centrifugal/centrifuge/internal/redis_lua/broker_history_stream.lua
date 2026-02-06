local stream_key = KEYS[1]
local meta_key = KEYS[2]
local include_publications = ARGV[1]
local since_offset = ARGV[2]
local limit = ARGV[3]
local reverse = ARGV[4]
local meta_expire = ARGV[5]
local new_epoch_if_empty = ARGV[6]

local stream_meta = redis.call("hmget", meta_key, "e", "s")
local current_epoch, top_offset = stream_meta[1], stream_meta[2]

if current_epoch == false then
    current_epoch = new_epoch_if_empty
    top_offset = 0
    redis.call("hset", meta_key, "e", current_epoch)
end

if top_offset == false then
    top_offset = 0
end

if meta_expire ~= '0' then
    redis.call("expire", meta_key, meta_expire)
end

local pubs = nil

if include_publications ~= "0" then
    if limit ~= "0" then
        if reverse == "0" then
            pubs = redis.call("xrange", stream_key, since_offset, "+", "COUNT", limit)
        else
            local get_offset = top_offset
            if since_offset ~= "0" then
                get_offset = since_offset
            end
            pubs = redis.call("xrevrange", stream_key, get_offset, "-", "COUNT", limit)
        end
    else
        if reverse == "0" then
            pubs = redis.call("xrange", stream_key, since_offset, "+")
        else
            local get_offset = top_offset
            if since_offset ~= "0" then
                get_offset = since_offset
            end
            pubs = redis.call("xrevrange", stream_key, get_offset, "-")
        end
    end
end

return { top_offset, current_epoch, pubs }
