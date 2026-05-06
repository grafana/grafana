local list_key = KEYS[1]
local meta_key = KEYS[2]
local include_publications = ARGV[1]
local list_right_bound = ARGV[2]
local meta_expire = ARGV[3]
local new_epoch_if_empty = ARGV[4]

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
    pubs = redis.call("lrange", list_key, 0, list_right_bound)
end

return { top_offset, current_epoch, pubs }
