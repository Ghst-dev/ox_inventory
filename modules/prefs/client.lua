--[[
    The shared interface preferences, forwarded to this resource's page.

    ghst_prefs owns three values -- reduce motion, interface size, interface volume -- and
    broadcasts them whenever they change. This carries them the last step, into the browser, where
    web/src/lib/prefs.svelte.ts applies them.

    A SOFT DEPENDENCY, deliberately. ghst_prefs is not in fxmanifest's dependencies{}, because a
    missing preferences resource should cost a player their preferences and not the inventory. The pcall
    is what makes that true: indexing an export on a resource that is not running raises, and it
    raises at this file's load time.

    Both directions are needed. ghst_prefs broadcasts on its own start, which covers ox_inventory
    starting first; the thread below covers ox_inventory starting second. And the page asks for itself
    at mount, because SendNUIMessage to a browser that has not finished loading is a message
    nobody receives.
]]

local function push(prefs)
    SendNUIMessage({ type = 'ghst:prefs', payload = prefs })
end

local function current()
    local ok, prefs = pcall(function() return exports.ghst_prefs:all() end)

    if ok and type(prefs) == 'table' then return prefs end
end

AddEventHandler('ghst_prefs:changed', push)

CreateThread(function()
    local prefs = current()

    if prefs then push(prefs) end
end)

RegisterNUICallback('ghst:prefs:ready', function(_, cb)
    cb(current() or {})
end)

--[[
    A page changing one, for the resources that offer a control for it.

    Every page can write and the owner is still ghst_prefs: this only forwards. The broadcast that
    follows updates every other page, including this one, so a control never applies its own change
    and the interfaces cannot disagree about the answer.
]]

RegisterNUICallback('ghst:prefs:set', function(data, cb)
    if type(data) == 'table' and type(data.id) == 'string' then
        pcall(function() exports.ghst_prefs:set(data.id, data.value) end)
    end

    cb({})
end)
