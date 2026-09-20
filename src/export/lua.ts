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
    if (block.modSrc !== "" && block.modAmt !== 0) usedLfos.add(Number(block.modSrc));
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
    const browserOnly = ["tune", "decay", "level"].includes(block.modDst)
      ? `  -- browser voice mod (${block.modDst}) not exported`
      : "";
    return `\t{ steps=${block.steps}, pulses=${block.pulses}, rot=${block.rot}, div=${block.div}, prob=${block.prob}, gate=${block.gate}, clk={${block.clk.map(sourceNumber).join(", ")}}, rst=${sourceNumber(block.rst)}, mut=${block.mut === "" ? 0 : Number(block.mut) + 1}, mn=${block.mute}, shape=${SHAPE_NUMBER[block.shape]}, msrc=${block.modSrc === "" ? 0 : Number(block.modSrc) + 1}, mdst=${DESTINATION_NUMBER[block.modDst]}, mamt=${block.modAmt.toFixed(2)}, out=${outputIndexes[index]}, lout=${lfoIndexes[index]}, tag=${luaString(block.voice ? voiceTag(block.voice) : "--")} },${browserOnly}`;
  });

  return `-- Euclid Grid
--[[
Sixteen Euclidean blocks on a shared clock tree, exported from the Euclidean
Grid Sequencer. Input 1 is the clock, input 2 is reset. Blocks clock each
other, reset each other, mute each other with their gates and modulate each
other with their step LFOs. Tempo lives outside: feed it a clock.
Exported ${date.toISOString().slice(0, 10)} at ${patch.bpm} BPM, 1/${patch.rate * 4} clock.
]]

local BAR = ${patch.rate * 4}\t\t-- clock pulses per bar

-- steps/pulses/rot: the Euclidean pattern. div: clock divide. prob: chance %.
-- gate: gate length, % of one clock. clk: clock sources (0 = clock input,
-- n = trigger out of block n). rst/mut/msrc: block numbers, 0 or -9 = unused.
local blocks = {
${rows.join("\n")}
}

local NB = #blocks
local pos, cnt, gate, lfo, rnd = {}, {}, {}, {}, {}
for i = 1, NB do pos[i] = -1 cnt[i] = 0 gate[i] = 0 lfo[i] = 0 rnd[i] = 0 end

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

local function effective( i )
\tlocal b = blocks[i]
\tlocal m = 0.0
\tif b.msrc > 0 and b.mamt ~= 0 then m = ( lfo[b.msrc] * 2 - 1 ) * b.mamt end
\tlocal steps, pulses, rot, div, prob = b.steps, b.pulses, b.rot, b.div, b.prob
\tif b.mdst == 1 then pulses = math.floor( pulses + m * 8 + 0.5 )
\telseif b.mdst == 2 then rot = math.floor( rot + m * steps + 0.5 )
\telseif b.mdst == 3 then prob = prob + m * 100
\telseif b.mdst == 4 then div = math.floor( div + m * 4 + 0.5 ) end
\tif pulses < 0 then pulses = 0 end
\tif pulses > steps then pulses = steps end
\tif div < 1 then div = 1 end
\treturn steps, pulses, rot, div, prob
end

local function advance( i )
\tlocal b = blocks[i]
\tcnt[i] = cnt[i] + 1
\tlocal steps, pulses, rot, div, prob = effective( i )
\tif cnt[i] % div ~= 0 then return false end
\tpos[i] = ( pos[i] + 1 ) % steps
\tif pos[i] == 0 then rnd[i] = math.random() end
\tlfo[i] = shapeValue( b.shape, pos[i] / steps, rnd[i] )
\tif not euclidHit( pos[i], steps, pulses, rot ) then return false end
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
\t\t\tif blocks[i].rst == s then pos[i] = -1 cnt[i] = 0 end
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
\t\t\tfor i = 1, NB do pos[i] = -1 cnt[i] = 0 end
\t\tend
\t\treturn outs
\tend
,\tstep = function( self, dt, inputs )
\t\tlocal o = {}
\t\tfor i = 1, NB do
\t\t\tif gate[i] > 0 then
\t\t\t\tgate[i] = gate[i] - dt
\t\t\t\tif gate[i] <= 0 then
\t\t\t\t\tgate[i] = 0
\t\t\t\t\tif blocks[i].out > 0 then o[blocks[i].out] = 0.0 end
\t\t\t\tend
\t\t\tend
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
