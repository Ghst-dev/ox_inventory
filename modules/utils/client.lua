if not lib then return end

local Utils = {}

function Utils.PlayAnim(wait, dict, name, blendIn, blendOut, duration, flag, rate, lockX, lockY, lockZ)
    lib.requestAnimDict(dict)
    TaskPlayAnim(cache.ped, dict, name, blendIn, blendOut, duration, flag, rate, lockX, lockY, lockZ)
    RemoveAnimDict(dict)

    if wait > 0 then Wait(wait) end
end

function Utils.PlayAnimAdvanced(wait, dict, name, posX, posY, posZ, rotX, rotY, rotZ, blendIn, blendOut, duration, flag,
                                time)
    lib.requestAnimDict(dict)
    TaskPlayAnimAdvanced(cache.ped, dict, name, posX, posY, posZ, rotX, rotY, rotZ, blendIn, blendOut, duration, flag,
        time, 0, 0)
    RemoveAnimDict(dict)

    if wait > 0 then Wait(wait) end
end

---@param flag number
---@param destination? vector3
---@param size? number
---@return number | false
---@return number?
function Utils.Raycast(flag, destination, size)
    local playerCoords = GetEntityCoords(cache.ped)
    destination = destination or GetOffsetFromEntityInWorldCoords(cache.ped, 0.0, 2.2, -0.25)
    local rayHandle = StartShapeTestCapsule(playerCoords.x, playerCoords.y, playerCoords.z + 0.5, destination.x,
        destination.y, destination.z, size or 2.2, flag or 30, cache.ped, 4)
    while true do
        Wait(0)
        local result, _, coords, _, entityHit = GetShapeTestResult(rayHandle)
        if result ~= 1 then
            -- DrawLine(playerCoords.x, playerCoords.y, playerCoords.z + 0.5, destination.x, destination.y, destination.z, 0, 0, 255, 255)
            -- DrawLine(playerCoords.x, playerCoords.y, playerCoords.z + 0.5, coords.x, coords.y, coords.z, 255, 0, 0, 255)
            local entityType
            if entityHit then entityType = GetEntityType(entityHit) end
            if entityHit and entityType ~= 0 then
                return entityHit, entityType
            end
            return false
        end
    end
end

function Utils.GetClosestPlayer()
    local players = GetActivePlayers()
    local playerCoords = GetEntityCoords(cache.ped)
    local targetDistance, targetId, targetPed

    for i = 1, #players do
        local player = players[i]

        if player ~= cache.playerId then
            local ped = GetPlayerPed(player)
            local distance = #(playerCoords - GetEntityCoords(ped))

            if distance < (targetDistance or 2) then
                targetDistance = distance
                targetId = player
                targetPed = ped
            end
        end
    end

    return targetId, targetPed
end

-- Replace ox_inventory notify with ox_lib (backwards compatibility)
function Utils.Notify(data)
    data.description = data.text
    data.text = nil
    lib.notify(data)
end

RegisterNetEvent('ox_inventory:notify', Utils.Notify)
exports('notify', Utils.Notify)

local notifySuppressed = false

---@param value boolean
local function setNotifySuppressed(value)
    notifySuppressed = value
end

RegisterNetEvent('ox_inventory:suppressItemNotifications', setNotifySuppressed)
exports('suppressItemNotifications', setNotifySuppressed)

function Utils.ItemNotify(data)
    if notifySuppressed or not client.itemnotify then
        return
    end

    SendNUIMessage({ action = 'itemNotify', data = data })
end

RegisterNetEvent('ox_inventory:itemNotify', Utils.ItemNotify)

---@deprecated
function Utils.DeleteObject(obj)
    SetEntityAsMissionEntity(obj, false, true)
    DeleteObject(obj)
end

function Utils.DeleteEntity(entity)
    if DoesEntityExist(entity) then
        SetEntityAsMissionEntity(entity, false, true)
        DeleteEntity(entity)
    end
end

local rewardTypes = 1 << 0 | 1 << 1 | 1 << 2 | 1 << 3 | 1 << 7 | 1 << 10

local weaponWheelOverride = false

---Enables the weapon wheel, but disables the use of inventory weapons.
---Mostly used for weaponised vehicles, though could be called for "minigames"
---@param state? boolean
---@param override? boolean
function Utils.WeaponWheel(state, override)
    if not override and weaponWheelOverride and state == false then
        return
    end
    if client.disableweapons then state = true end
    if state == nil then state = EnableWeaponWheel end

    if override then
        weaponWheelOverride = state or false
    end

    EnableWeaponWheel = state
    SetWeaponsNoAutoswap(not state)
    SetWeaponsNoAutoreload(not state)

    if client.suppresspickups then
        -- CLEAR_PICKUP_REWARD_TYPE_SUPPRESSION | SUPPRESS_PICKUP_REWARD_TYPE
        return state and N_0x762db2d380b48d04(rewardTypes) or N_0xf92099527db8e2a7(rewardTypes, true)
    end
end

exports('weaponWheel', function (state)
    Utils.WeaponWheel(state, true)
end)

function Utils.CreateBlip(settings, coords)
    local blip = AddBlipForCoord(coords.x, coords.y, coords.z)
    SetBlipSprite(blip, settings.id)
    SetBlipDisplay(blip, 4)
    SetBlipScale(blip, settings.scale)
    SetBlipColour(blip, settings.colour)
    SetBlipAsShortRange(blip, true)
    BeginTextCommandSetBlipName(settings.name)
    EndTextCommandSetBlipName(blip)

    return blip
end

---Takes OxTargetBoxZone or legacy zone data (PolyZone) and creates a zone.
---@param data OxTargetBoxZone | { length: number, minZ: number, maxZ: number, loc: vector3, heading: number, width: number, distance: number }
---@param options? OxTargetOption[]
---@return number
function Utils.CreateBoxZone(data, options)
    if data.length then
        local height = math.abs(data.maxZ - data.minZ)
        local z = data.loc.z + math.abs(data.minZ - data.maxZ) / 2
        data.coords = vec3(data.loc.x, data.loc.y, z)
        data.size = vec3(data.width, data.length, height)
        data.rotation = data.heading
        data.loc = nil
        data.heading = nil
        data.length = nil
        data.width = nil
        data.maxZ = nil
        data.minZ = nil
    end

    if not data.options and options then
        local distance = data.distance or 2.0

        for k, v in pairs(options) do
            if not v.distance then
                v.distance = distance
            end
        end

        data.options = options
    end

    return exports.ox_target:addBoxZone(data)
end

local hasTextUi

---@param point CPoint
function Utils.nearbyMarker(point)
    DrawMarker(point.marker.type, point.coords.x, point.coords.y, point.coords.z, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, point.marker.scale[1], point.marker.scale[2], point.marker.scale[3],
        ---@diagnostic disable-next-line: param-type-mismatch
        point.marker.colour[1], point.marker.colour[2], point.marker.colour[3], 222, false, false, 0, true, false, false, false)

    if point.isClosest and point.currentDistance < 1.2 then
        if not hasTextUi then
            hasTextUi = point
            lib.showTextUI(point.prompt.message, point.prompt.options)
        end

        if IsControlJustReleased(0, 38) then
            CreateThread(function()
                if point.inv == 'policeevidence' then
                    client.openInventory('policeevidence')
                elseif point.inv == 'crafting' then
                    client.openInventory('crafting', { id = point.benchid, index = point.index })
                else
                    client.openInventory(point.inv or 'drop', { id = point.invId, type = point.type })
                end
            end)
        end
    elseif hasTextUi == point then
        hasTextUi = nil
        lib.hideTextUI()
    end
end

function Utils.blurIn()
    if IsScreenblurFadeRunning() then
        DisableScreenblurFade()
    end

    TriggerScreenblurFadeIn(100)
end

function Utils.blurOut()
    if IsScreenblurFadeRunning() then
        DisableScreenblurFade()
    end

    TriggerScreenblurFadeOut(250)
end

--[[
    A copy of the player, stood in front of the camera while the inventory is open.

    OFF BY DEFAULT, AND TUNABLE WITHOUT A REBUILD. `inventory:preview` switches it on;
    `inventory:previewoffset` is [distance, side, drop] in metres from the camera. Those
    three numbers decide the framing, and the right values depend on aspect ratio, FOV and
    how wide the two panes end up on a given screen — none of which can be guessed
    correctly from outside the game. Making them convars means nudging the ped into the
    margin is a server restart, not a UI rebuild. Negative `side` puts it to the left of
    the panes, which is where the empty screen is at 16:9.

    NOT A RENDER TARGET. This is a real ped standing in the world beside the camera, which
    is why it needs the light: it is lit by wherever the player actually is, so at night or
    indoors it would otherwise be a silhouette.
]]
local previewPed
local previewOffset = json.decode(GetConvar('inventory:previewoffset', '')) or { 2.2, -0.75, 0.7 }

---Forward and right vectors for the gameplay camera, both flattened enough to be useful.
---Right is deliberately level: sliding the ped sideways across the screen should not also
---slide it up or down when the player happens to be looking at the sky.
local function cameraBasis()
    local rot = GetGameplayCamRot(2)
    local z = math.rad(rot.z)
    local x = math.rad(rot.x)
    local cosX = math.abs(math.cos(x))

    return vec3(-math.sin(z) * cosX, math.cos(z) * cosX, math.sin(x)), vec3(math.cos(z), math.sin(z), 0.0), rot
end

function Utils.previewIn()
    -- Self-gating so the three places that open an inventory each call one unconditional
    -- line. A condition repeated at three call sites is a condition that gets it wrong at
    -- one of them.
    if not client.preview or previewPed then return end

    previewPed = ClonePed(cache.ped, false, false, true)

    if not previewPed or previewPed == 0 then
        previewPed = nil
        return
    end

    SetEntityInvincible(previewPed, true)
    SetEntityCanBeDamaged(previewPed, false)
    SetEntityCollision(previewPed, false, false)
    SetBlockingOfNonTemporaryEvents(previewPed, true)
    SetPedCanRagdoll(previewPed, false)
    -- Marked as a mission entity so DeleteEntity is guaranteed to take: an unmarked ped can
    -- be culled by the engine's own population manager, and then the delete does nothing
    -- and the handle is left dangling.
    SetEntityAsMissionEntity(previewPed, true, true)

    CreateThread(function()
        -- The camera does not turn while the inventory is open — SetNuiFocus captures the
        -- mouse — so this could in principle place the ped once. It runs every frame
        -- anyway, because DrawLightWithRange has to, and because a placement that survives
        -- the camera moving for any reason is one less thing that can look broken.
        while previewPed do
            local ped = previewPed
            local camera = GetGameplayCamCoord()
            local forward, right, rot = cameraBasis()

            local at = camera + forward * previewOffset[1] + right * previewOffset[2] -
                vec3(0.0, 0.0, previewOffset[3])

            SetEntityCoordsNoOffset(ped, at.x, at.y, at.z, false, false, false)
            -- Turned to face the camera rather than away from it, which is the whole point.
            SetEntityHeading(ped, rot.z + 180.0)
            DrawLightWithRange(at.x, at.y, at.z + 1.2, 255, 255, 255, 2.5, 6.0)

            Wait(0)
        end
    end)
end

function Utils.previewOut()
    if not previewPed then return end

    -- Cleared before the delete so the render thread above stops on its next tick rather
    -- than drawing against a handle that has just been freed.
    local ped = previewPed
    previewPed = nil

    Utils.DeleteEntity(ped)
end

-- A resource restart with the inventory open would otherwise leave the clone standing in
-- the world with nothing left to delete it.
AddEventHandler('onResourceStop', function(resource)
    if resource == shared.resource then Utils.previewOut() end
end)

---@param serverId number
---@return string
local function defaultGetPlayerName(serverId)
    local playerId = GetPlayerFromServerId(serverId)
    local playerName = GetPlayerName(playerId)
    return ('[%d] %s'):format(serverId, playerName)
end

local getPlayerName = defaultGetPlayerName

exports('setGetPlayerNameMethod', function (fn)
    if type(fn) == "function" then
        getPlayerName = fn
    else
        getPlayerName = defaultGetPlayerName
    end
end)

function Utils.getPlayerName(serverId)
    return getPlayerName(serverId)
end

return Utils
