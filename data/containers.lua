--[[
	Container items -- the bags. Loaded by `modules/items/containers.lua`, which registers each
	entry through `setContainerProperties`.

	This copy is the fork's placeholder and **does not deploy**: `.sync` excludes `data/`, because
	the item list, shops and stashes are the server's content rather than the fork's. The real
	list lives in the deployed tree at `[ox]/ox_inventory/data/containers.lua`, next to the item
	list its names have to match.

		slots       how many squares the bag has.
		maxWeight   grams of bulk it will hold.
		whitelist   optional array or set of item names -- only these may go in.
		blacklist   optional array or set of item names -- these may not.

	Note that a bag's contents still count against the player's own weight limit
	(`Inventory.ContainerWeight`). `maxWeight` caps what fits in the bag; it does not raise what
	the player can carry.
]]
return {
	paperbag = {
		slots = 5,
		maxWeight = 1000,
		blacklist = { 'testburger' }
	},
}
