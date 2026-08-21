local containers = {}

local function arrayToSet(tbl)
	local size = #tbl
	local set = table.create(0, size)

	for i = 1, size do
		set[tbl[i]] = true
	end

	return set
end

---Registers items with itemName as containers (i.e. backpacks, wallets).
---@param itemName string
---@param properties ItemContainerProperties
---@todo Rework containers for flexibility, improved data structure; then export this method.
local function setContainerProperties(itemName, properties)
	local blacklist, whitelist = properties.blacklist, properties.whitelist

	if blacklist then
		local tableType = table.type(blacklist)

		if tableType == 'array' then
			blacklist = arrayToSet(blacklist)
		elseif tableType ~= 'hash' then
			TypeError('blacklist', 'table', type(blacklist))
		end
	end

	if whitelist then
		local tableType = table.type(whitelist)

		if tableType == 'array' then
			whitelist = arrayToSet(whitelist)
		elseif tableType ~= 'hash' then
			TypeError('whitelist', 'table', type(whitelist))
		end
	end

	containers[itemName] = {
		size = { properties.slots, properties.maxWeight },
		blacklist = blacklist,
		whitelist = whitelist,
	}
end

exports('setContainerProperties', setContainerProperties)

--[[
	The bags themselves are server content, not fork code, so they are declared in
	`data/containers.lua` beside the item list rather than written out here. Upstream hard-codes
	two demo containers at this point -- a paperbag and a pizzabox, the second of which is not an
	item -- and every server that ever added a backpack did it by editing this file, which an
	upstream bump then reverts.

	`.sync` excludes `data/`, so the list survives a deploy the same way items.lua does. A missing
	file is not an error: `lib.load` returns nil, no container is registered, and the container
	code paths simply never fire.
]]
for itemName, properties in pairs(lib.load('data.containers') or {}) do
	setContainerProperties(itemName, properties)
end

return containers
