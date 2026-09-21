import { BLOCK_COUNT, type LfoShape, type ModDestination, type Patch } from "@/lib/types";
import { padBlock, voiceName, voiceTag } from "@/lib/constants";

const SHAPE_NUMBER: Record<LfoShape, number> = { ramp: 1, tri: 2, sqr: 3, rnd: 4 };
const DESTINATION_NUMBER: Record<ModDestination, number> = {
  "": 0,
  pulses: 1,
  rot: 2,
  prob: 3,
  div: 4,
  tune: 0,
  decay: 0,
  level: 0,
};

const sourceNumber = (value: string) => {
  if (value === "") return -9;
  if (value === "G") return 0;
  if (value === "BAR") return -1;
  return Number(value) + 1;
};

const luaString = (value: string) => `"${value.replaceAll('"', '\\"')}"`;

export function buildLua(patch: Patch, date = new Date()): string {
  const usedTriggers = new Set<number>();
  const usedLfos = new Set<number>();
  patch.blocks.forEach((block) => {
    block.clk.forEach((source) => source !== "G" && usedTriggers.add(Number(source)));
    if (!["", "G", "BAR"].includes(block.rst)) usedTriggers.add(Number(block.rst));
    if (block.mut !== "") usedTriggers.add(Number(block.mut));
    block.modulations.forEach((route) => { if (route.source !== "" && route.amount !== 0) usedLfos.add(Number(route.source)); });
  });

  const types: string[] = [];
  const names: string[] = [];
  const outputIndexes = new Array(BLOCK_COUNT).fill(0) as number[];
  const lfoIndexes = new Array(BLOCK_COUNT).fill(0) as number[];
  patch.blocks.forEach((block, index) => {
    if (types.length >= 28 || (!block.voice && !usedTriggers.has(index))) return;
    types.push("kStepped");
    names.push(luaString(`${padBlock(index)} ${block.voice ? voiceName(block.voice) : "trig"}`));
    outputIndexes[index] = types.length;
  });
  patch.blocks.forEach((_block, index) => {
    if (types.length >= 28 || !usedLfos.has(index)) return;
    types.push("kLinear");
    names.push(luaString(`${padBlock(index)} LFO`));
    lfoIndexes[index] = types.length;
  });
  if (!types.length) {
    types.push("kStepped");
    names.push(luaString("01 trig"));
    outputIndexes[0] = 1;
  }

  const rows = patch.blocks.map((block, index) => {
    const voiceTargets = block.modulations.filter((route) => ["tune", "decay", "level"].includes(route.destination));
    const browserOnly = voiceTargets.length ? `  -- browser voice mod (${voiceTargets.map((route) => route.destination).join(", ")}) not exported` : "";
    const mods = block.modulations.filter((route) => route.source !== "" && DESTINATION_NUMBER[route.destination] > 0).map((route) => `{ src=${Number(route.source) + 1}, dst=${DESTINATION_NUMBER[route.destination]}, amt=${route.amount.toFixed(2)} }`).join(", ");
    return `\t{ steps=${block.steps}, pulses=${block.pulses}, rot=${block.rot}, div=${block.div}, prob=${block.prob}, gate=${block.gate}, clk={${block.clk.map(sourceNumber).join(", ")}}, rst=${sourceNumber(block.rst)}, mut=${block.mut === "" ? 0 : Number(block.mut) + 1}, mn=${block.mute}, shape=${SHAPE_NUMBER[block.shape]}, euclidean=${!block.voice}, mods={${mods}}, out=${outputIndexes[index]}, lout=${lfoIndexes[index]}, tag=${luaString(block.voice ? voiceTag(block.voice) : "--")} },${browserOnly}`;
  });

  return `-- Euclid Grid
--[[
Sixteen Euclidean blocks on a shared clock tree, exported from the Euclidean
Grid Sequencer. Input 1 is the clock, input 2 is reset. Blocks clock each
other, reset each other, mute each other with their gates and modulate each
other with Euclidean cycle LFOs (modulators) or step LFOs (voices). Tempo lives outside: feed it a clock.
Exported ${date.toISOString().slice(0, 10)} at ${patch.bpm} BPM, 1/${patch.rate * 4} clock.
]]

local BAR = ${patch.rate * 4}\t\t-- clock pulses per bar

-- steps/pulses/rot: the Euclidean pattern. div: clock divide. prob: chance %.
-- gate: gate length, % of one clock. clk: clock sources (0 = clock input,
-- n = trigger out of block n). rst/mut/mods.src: block numbers, 0 or -9 = unused.
local blocks = {
${rows.join("\n")}
}

local NB = #blocks
local pos, cnt, gate, lfo, rnd = {}, {}, {}, {}, {}
local lastClock, waveTime, duration, rhythm = {}, {}, {}, {}
local now = 0
for i = 1, NB do
\tpos[i] = -1 cnt[i] = 0 gate[i] = 0
\tlfo[i] = blocks[i].euclidean and 0.5 or 0 rnd[i] = 0
end

local outs = {}
local gateLen, probScale, lfoDepth, muteAll = 0.02, 1.0, 5.0, false
local gcount = 0

local function euclidHit( i, steps, pulses, rot )
\tif pulses <= 0 then return false end
\tif pulses >= steps then return true end
\tlocal k = ( i + rot ) % steps
\treturn ( k * pulses ) % steps < pulses
end

local function shapeValue( shape, ph, r )
\tif shape == 2 then
\t\tlocal v = ph * 2
\t\tif v > 1 then v = 2 - v end
\t\treturn v
\telseif shape == 3 then
\t\tif ph < 0.5 then return 1.0 else return 0.0 end
\telseif shape == 4 then
\t\treturn r
\tend
\treturn ph
end

-- A complete waveform fills each interval between Euclidean hits.
local function cyclePhase( p, r )
\tif r.pulses <= 0 then return nil end
\tfor back = 0, r.steps - 1 do
\t\tlocal start = math.floor(p) - back
\t\tif euclidHit(start, r.steps, r.pulses, r.rot) then
\t\t\tfor length = 1, r.steps do
\t\t\t\tif euclidHit(start + length, r.steps, r.pulses, r.rot) then
\t\t\t\t\treturn (p - start) / length
\t\t\t\tend
\t\t\tend
\t\tend
\tend
end

local function updateLfo( i )
\tlocal b, r = blocks[i], rhythm[i]
\tif not r then lfo[i] = b.euclidean and 0.5 or 0 return end
\tif not b.euclidean then return end
\tlocal fraction = math.min(1, math.max(0, (now - waveTime[i]) / duration[i]))
\tlocal phase = cyclePhase(pos[i] + fraction, r)
\tlfo[i] = phase and shapeValue(b.shape, phase, rnd[i]) or 0.5
end

local function resetBlock( i )
\tpos[i] = -1 cnt[i] = 0 rhythm[i] = nil lastClock[i] = nil
\tlfo[i] = blocks[i].euclidean and 0.5 or 0
end

local function effective( i )
\tlocal b = blocks[i]
\tlocal steps, pulses, rot, div, prob = b.steps, b.pulses, b.rot, b.div, b.prob
\tfor _, route in ipairs( b.mods ) do
\t\tupdateLfo(route.src)
\t\tlocal m = ( lfo[route.src] * 2 - 1 ) * route.amt
\t\tif route.dst == 1 then pulses = math.floor( pulses + m * 8 + 0.5 )
\t\telseif route.dst == 2 then rot = math.floor( rot + m * steps + 0.5 )
\t\telseif route.dst == 3 then prob = prob + m * 100
\t\telseif route.dst == 4 then div = math.floor( div + m * 4 + 0.5 ) end
\tend
\tif pulses < 0 then pulses = 0 end
\tif pulses > steps then pulses = steps end
\tdiv = math.min(16, math.max(1, div))
\tprob = math.min(100, math.max(0, prob))
\treturn steps, pulses, rot, div, prob
end

local function advance( i )
\tlocal b = blocks[i]
\tlocal interval = lastClock[i] and math.max(0.008, now - lastClock[i]) or 0.125
\tlastClock[i] = now
\tcnt[i] = cnt[i] + 1
\tlocal steps, pulses, rot, div, prob = effective( i )
\tif cnt[i] % div ~= 0 then return false end
\tpos[i] = ( pos[i] + 1 ) % steps
\tlocal hit = euclidHit(pos[i], steps, pulses, rot)
\tif (b.euclidean and hit) or (not b.euclidean and pos[i] == 0) then rnd[i] = math.random() end
\trhythm[i] = { steps=steps, pulses=pulses, rot=rot }
\twaveTime[i] = now duration[i] = interval * div
\tif b.euclidean then updateLfo(i)
\telse lfo[i] = shapeValue(b.shape, pos[i] / steps, rnd[i]) end
\tif not hit then return false end
\tif muteAll or b.mn then return false end
\tif b.mut > 0 and gate[b.mut] > 0 then return false end
\tif math.random() * 100 >= prob * probScale then return false end
\tgate[i] = gateLen * ( b.gate / 50 )
\tif b.out > 0 then outs[b.out] = 5.0 end
\treturn true
end

local queue = {}
local function pulse( src )
\tqueue[1] = src
\tlocal head, tail, guard = 1, 1, 0
\twhile head <= tail and guard < 200 do
\t\tlocal s = queue[head]
\t\thead = head + 1
\t\tguard = guard + 1
\t\tfor i = 1, NB do
\t\t\tif blocks[i].rst == s then resetBlock(i) end
\t\tend
\t\tfor i = 1, NB do
\t\t\tlocal c = blocks[i].clk
\t\t\tfor k = 1, #c do
\t\t\t\tif c[k] == s then
\t\t\t\t\tif advance( i ) then tail = tail + 1 queue[tail] = i end
\t\t\t\t\tbreak
\t\t\t\tend
\t\t\tend
\t\tend
\tend
end

return
{
\tname = 'Euclid Grid'
,\tauthor = 'Euclidean Grid Sequencer'
,\tinit = function( self )
\t\treturn
\t\t{
\t\t\tinputs = { kTrigger, kTrigger }
\t\t,\tinputNames = { "Clock", "Reset" }
\t\t,\toutputs = { ${types.join(", ")} }
\t\t,\toutputNames = { ${names.join(", ")} }
\t\t,\tparameters =
\t\t\t{
\t\t\t\t{ "Gate", 1, 200, 20, kMs }
\t\t\t,\t{ "Probability", 0, 200, 100, kPercent }
\t\t\t,\t{ "LFO depth", 0, 100, 50, kVolts, kBy10 }
\t\t\t,\t{ "Mute all", { "Off", "On" }, 1 }
\t\t\t}
\t\t}
\tend
,\ttrigger = function( self, input )
\t\touts = {}
\t\tgateLen = self.parameters[1] / 1000
\t\tprobScale = self.parameters[2] / 100
\t\tlfoDepth = self.parameters[3]
\t\tmuteAll = self.parameters[4] == 2
\t\tif input == 1 then
\t\t\tgcount = gcount + 1
\t\t\tif gcount % BAR == 1 then pulse( -1 ) end
\t\t\tpulse( 0 )
\t\telse
\t\t\tgcount = 0
\t\t\tfor i = 1, NB do resetBlock(i) end
\t\tend
\t\treturn outs
\tend
,\tstep = function( self, dt, inputs )
\t\tnow = now + dt
\t\tlocal o = {}
\t\tfor i = 1, NB do
\t\t\tif gate[i] > 0 then
\t\t\t\tgate[i] = gate[i] - dt
\t\t\t\tif gate[i] <= 0 then
\t\t\t\t\tgate[i] = 0
\t\t\t\t\tif blocks[i].out > 0 then o[blocks[i].out] = 0.0 end
\t\t\t\tend
\t\t\tend
\t\t\tupdateLfo(i)
\t\t\tif blocks[i].lout > 0 then o[blocks[i].lout] = lfo[i] * lfoDepth end
\t\tend
\t\treturn o
\tend
,\tdraw = function( self )
\t\tdrawTinyText( 2, 7, "EUCLID GRID", 8 )
\t\tfor i = 1, NB do
\t\t\tlocal col = ( i - 1 ) % 4
\t\t\tlocal row = math.floor( ( i - 1 ) / 4 )
\t\t\tlocal x = 4 + col * 16
\t\t\tlocal y = 12 + row * 13
\t\t\tdrawBox( x, y, x + 13, y + 10, 3 )
\t\t\tif gate[i] > 0 then
\t\t\t\tdrawRectangle( x + 1, y + 1, x + 12, y + 9, 15 )
\t\t\telse
\t\t\t\tdrawTinyText( x + 2, y + 7, blocks[i].tag, 6 )
\t\t\tend
\t\tend
\t\tfor i = 1, NB do
\t\t\tlocal x = 76 + ( i - 1 ) * 11
\t\t\tif x < 250 then
\t\t\t\tdrawRectangle( x, 58 - math.floor( lfo[i] * 14 ), x + 8, 58, 4 + math.floor( lfo[i] * 8 ) )
\t\t\tend
\t\tend
\t\treturn true
\tend
}
`;
}
