--- ox_inventory -- carry capacity earned rather than granted.
---
--- Every player on this server carries `inventory:weight` and always has. A `ghst_skills`
--- `strength` rank now adds to it, up to `inventory:strengthweight` at the top of the scale --
--- so the number in the corner of the inventory is something a character built rather than a
--- property of the server.
---
--- **Rank 0 is the convar unchanged**, which is what every character starts on and what the
--- server did before this file existed. Nothing here can take capacity away.
---
--- A fork change rather than an integration written the other way round, because `maxWeight`
--- belongs to this resource: `Inventory.SetMaxWeight` is the only thing that may write it, and it
--- has a client event to fire afterwards. `ghst_skills` answers what the rank is and nothing more.
--- The licences allow this direction and not every direction -- ox_inventory is GPL-3.0 like the
--- `ghst_*` resources, where ox_lib and ox_target are not. See `Tools/README.md`.

local Inventory = require 'modules.inventory.server'

--- Grams added at the top of the strength scale. 0 disables the whole file, which is how a server
--- that wants flat capacity turns this off without editing anything.
local bonus = GetConvarInt('inventory:strengthweight', 25000)

--- Cached because it cannot change without a restart of that resource, and this is asked on every
--- spawn. `nil` means it has not been asked yet; `false` means there is nobody to ask.
--- @type number | false | nil
local maxRank

--- @param source number
--- @return number grams
local function capacityFor(source)
    if bonus == 0 or GetResourceState('ghst_skills') ~= 'started' then return shared.playerweight end

    if maxRank == nil then
        maxRank = exports.ghst_skills:MaxRank() or false
    end

    if not maxRank or maxRank <= 0 then return shared.playerweight end

    --- Takes a source *or* a citizenid, and reads the character's metadata directly when this
    --- resource asks before `ghst_skills` has loaded them -- which is the whole reason the order
    --- these two resources start in does not matter here.
    local rank = exports.ghst_skills:GetRank(source, 'strength') or 0

    return shared.playerweight + math.floor(bonus * (rank / maxRank))
end

--- @param source number
local function apply(source)
    Inventory.SetMaxWeight(source, capacityFor(source))
end

--- A rank that moved while the player is on the server. Raised by `ghst_skills`' server, so it is
--- the number changing rather than a client saying it did.
---
--- Capacity only ever rises here, so there is no case where this leaves somebody over their own
--- limit. If `bonus` is ever made negative, that stops being true -- `Inventory.SetMaxWeight` does
--- not shed items, it only stops more going in.
AddEventHandler('ghst_skills:rankChanged', function(src, id)
    if id ~= 'strength' then return end

    apply(src)
end)

return apply
