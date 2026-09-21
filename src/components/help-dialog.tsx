import { useState } from "react";
import { ArrowRight, CircleHelp, Headphones, Lightbulb } from "lucide-react";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HELP_CHAPTERS } from "@/components/help-content";
import { euclidHit } from "@/lib/euclid";
import "./help-dialog.css";

// The position is the identity of each step in this fixed 16-step illustration.
const DEMO_STEPS = Array.from({ length: 16 }, (_, index) => ({ index, id: `help-step-${index}` }));
const RECIPE = [
  { voice: "Kick", tag: "BD", fill: 4, rotation: 0 },
  { voice: "Clap", tag: "CP", fill: 2, rotation: 4 },
  { voice: "Closed hat", tag: "CH", fill: 4, rotation: 2 },
  { voice: "Rim", tag: "RS", fill: 3, rotation: 0 },
];

export function HelpDialog() {
  return <Dialog>
    <DialogTrigger asChild><button type="button" className="icon-button" aria-label="Open Beatling help" title="Help & beat building"><CircleHelp size={16} /></button></DialogTrigger>
    <DialogContent className="help-dialog" onKeyDown={(event) => event.stopPropagation()}>
      <header className="help-header">
        <span className="eyebrow">Beatling / Field guide</span>
        <DialogTitle>Find your rhythm.</DialogTitle>
        <DialogDescription>From your first loop to the details of the patch bay.</DialogDescription>
      </header>
      <Tabs defaultValue="start" className="help-layout">
        <TabsList className="help-nav" aria-label="Help chapters">
          {HELP_CHAPTERS.map((chapter, index) => <TabsTrigger key={chapter.id} value={chapter.id} className="help-nav-item"><span aria-hidden="true">0{index + 1}</span>{chapter.label}</TabsTrigger>)}
        </TabsList>
        {HELP_CHAPTERS.map((chapter) => <TabsContent key={chapter.id} value={chapter.id} className="help-page">
          <div className="help-chapter-heading"><span className="eyebrow">{chapter.label}</span><h3>{chapter.title}</h3><p>{chapter.intro}</p></div>
          {chapter.id === "start" && <RhythmPlayground />}
          {chapter.id === "build" && <BeatRecipe />}
          {chapter.id === "patch" && <div className="help-signal-flow" aria-label="Signal flow"><span>Source block</span><ArrowRight size={16} aria-hidden="true" /><span>Trigger · Gate · LFO</span><ArrowRight size={16} aria-hidden="true" /><span>Receiving input</span></div>}
          <div className="help-cards">{chapter.cards.map((card) => <section className="help-card" key={card.title}><h4>{card.title}</h4><p>{card.text}</p></section>)}</div>
          {chapter.id === "save" && <KeyboardGuide />}
          <aside className="help-tip"><Lightbulb size={18} aria-hidden="true" /><p>{chapter.tip}</p></aside>
        </TabsContent>)}
      </Tabs>
      <footer className="help-footer"><span><Headphones size={14} aria-hidden="true" />Read a little. Play a little.</span><DialogClose asChild><button type="button">Back to the beat <ArrowRight size={14} aria-hidden="true" /></button></DialogClose></footer>
    </DialogContent>
  </Dialog>;
}

function RhythmPlayground() {
  const [fill, setFill] = useState(5);
  const [rotate, setRotate] = useState(0);
  const hits = DEMO_STEPS.filter(({ index }) => euclidHit(index, 16, fill, rotate)).map(({ index }) => index + 1);
  return <section className="help-playground" aria-label="Interactive Euclidean rhythm example">
    <svg viewBox="0 0 200 200" role="img" aria-label={`${fill} hits over 16 steps, rotation ${rotate}. Hit positions: ${hits.join(", ") || "none"}.`}>
      <circle className="help-orbit-guide" cx="100" cy="100" r="78" />
      <line className="help-orbit-guide" x1="100" y1="7" x2="100" y2="14" />
      {DEMO_STEPS.map(({ index, id }) => {
        const angle = index / 16 * Math.PI * 2 - Math.PI / 2;
        return <circle key={id} cx={100 + Math.cos(angle) * 78} cy={100 + Math.sin(angle) * 78} r={euclidHit(index, 16, fill, rotate) ? 7 : 4} className={euclidHit(index, 16, fill, rotate) ? "help-hit" : "help-rest"} />;
      })}
      <text x="100" y="100" className="help-orbit-count">{fill}<tspan className="help-orbit-total"> / 16</tspan></text>
      <text x="100" y="121" className="help-orbit-caption">HITS / STEPS</text>
    </svg>
    <div><span className="eyebrow">Try the idea</span><h4>More hits. Same circle.</h4><p>Move Fill to redistribute the hits. Move Rotate to shift the rhythm. This silent sketch is separate from your beat.</p>
      <label className="help-demo-control"><span>Fill <b aria-hidden="true">{fill}</b></span><input className="range" type="range" min="0" max="16" value={fill} onChange={(event) => setFill(Number(event.target.value))} /></label>
      <label className="help-demo-control"><span>Rotate <b aria-hidden="true">{rotate}</b></span><input className="range" type="range" min="0" max="15" value={rotate} onChange={(event) => setRotate(Number(event.target.value))} /></label>
    </div>
  </section>;
}

function BeatRecipe() {
  return <figure className="help-recipe">
    <figcaption><span className="eyebrow">Recipe 01 / A steady foundation</span><span>16 steps · 120 BPM</span></figcaption>
    <div className="help-recipe-scroll"><table><thead><tr><th scope="col">Voice</th><th scope="col">Fill</th><th scope="col">Rotate</th><th scope="col">One bar / four beats</th></tr></thead><tbody>
      {RECIPE.map(({ voice, tag, fill, rotation }) => <tr key={tag}><th scope="row"><span>{tag}</span>{voice}</th><td>{fill}</td><td>{rotation}</td><td><div className="help-step-strip" role="img" aria-label={`${voice} hits on steps ${DEMO_STEPS.filter(({ index }) => euclidHit(index, 16, fill, rotation)).map(({ index }) => index + 1).join(", ")}`}>
        {DEMO_STEPS.map(({ index, id }) => <i key={id} data-hit={euclidHit(index, 16, fill, rotation)} data-beat={index % 4 === 0} />)}
      </div></td></tr>)}
    </tbody></table></div>
    <p>All lanes: Steps 16 · Divide 1 · Chance 100% · Clock in G</p>
  </figure>;
}

function KeyboardGuide() {
  return <section className="help-keys"><h4>Keep your hands on the instrument</h4><dl>
    <div><dt><kbd>Space</kbd></dt><dd>Play / stop when not focused on a control or dialog</dd></div>
    <div><dt><kbd>⌘ / Ctrl Z</kbd></dt><dd>Undo a patch edit</dd></div>
    <div><dt><kbd>⇧ ⌘ / Ctrl Z</kbd> / <kbd>Ctrl Y</kbd></dt><dd>Redo a patch edit</dd></div>
    <div><dt><kbd>↑ ↓ ← →</kbd></dt><dd>Adjust a focused rhythm value; Shift changes by four</dd></div>
    <div><dt><kbd>Alt ← / →</kbd></dt><dd>Move a focused song part</dd></div>
    <div><dt><kbd>Esc</kbd></dt><dd>Close a dialog or the patch bay</dd></div>
    <div><dt><kbd>Tab</kbd></dt><dd>Move between controls; arrow keys navigate help chapters</dd></div>
  </dl></section>;
}
