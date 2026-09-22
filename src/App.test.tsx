import { act, cleanup, fireEvent, render, screen, within, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "@/App";
import { SequencerEngine } from "@/audio/engine";
import { createDemoPatch } from "@/lib/patch";
import { createArrangement } from "@/lib/variations";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  Reflect.deleteProperty(window, "showDirectoryPicker");
  Reflect.deleteProperty(window, "showOpenFilePicker");
  Reflect.deleteProperty(window, "showSaveFilePicker");
});

describe("application shell", () => {
  it("opens help beside the theme switch without changing the active patch", async () => {
    vi.spyOn(window.localStorage.__proto__, "getItem").mockReturnValue(null);
    const start = vi.spyOn(SequencerEngine.prototype, "start").mockResolvedValue();
    render(<App />);
    const help = screen.getByRole("button", { name: "Open Beatling help" });
    expect(help.nextElementSibling).toHaveAccessibleName(/Use (dark|light) theme/);
    fireEvent.click(screen.getByRole("button", { name: "Mute block 01" }));
    help.focus();
    fireEvent.click(help);
    fireEvent.change(screen.getByRole("slider", { name: /Fill/ }), { target: { value: "0" } });
    fireEvent.keyDown(screen.getByRole("tabpanel"), { key: "z", ctrlKey: true });
    fireEvent.keyDown(screen.getByRole("tabpanel"), { key: " ", code: "Space" });
    expect(start).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Close dialog" }));
    await waitFor(() => expect(help).toHaveFocus());
    expect(screen.getByRole("button", { name: "Unmute block 01" })).toBeInTheDocument();
    expect(within(screen.getByTestId("block-1")).getByRole("button", { name: "Fill: 4" })).toBeInTheDocument();
  });

  it("toggles optional cables without changing routing or blocking block controls", () => {
    vi.spyOn(window.localStorage.__proto__, "getItem").mockReturnValue(null);
    const save = vi.spyOn(window.localStorage.__proto__, "setItem");
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    render(<App />);
    const toggle = screen.getByRole("switch", { name: "Patch cables" });
    expect(toggle).toHaveAttribute("aria-checked", "false");
    expect(screen.queryByTestId("patch-cables")).not.toBeInTheDocument();
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-checked", "true");
    expect(screen.getByTestId("patch-cables")).toHaveStyle({ pointerEvents: "none" });
    expect(save).toHaveBeenCalledWith("beatling-show-cables", "true");
    fireEvent.click(screen.getByRole("button", { name: "Mute block 01" }));
    expect(screen.getByRole("button", { name: "Unmute block 01" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Patch block 03" }));
    expect(screen.getByLabelText("Modulation source for chance")).toHaveValue("12");
    fireEvent.click(toggle);
    expect(screen.queryByTestId("patch-cables")).not.toBeInTheDocument();
  });

  it("renders all sequencer blocks and keeps primary controls interactive", () => {
    vi.spyOn(window.localStorage.__proto__, "getItem").mockReturnValue(null);
    render(<App />);
    expect(screen.getAllByTestId(/^block-/)).toHaveLength(16);
    expect(screen.getAllByTitle("Roland voice code for Kick")).toHaveLength(2);
    expect(screen.getAllByTitle("Roland voice code for Shaker")).toHaveLength(2);
    expect(screen.getAllByTitle("Roland voice code for Shaker")[0]).toHaveTextContent("MA");
    expect(screen.getByLabelText("Beats per minute")).toHaveValue("124");
    fireEvent.click(screen.getByRole("button", { name: /mute block 01/i }));
    expect(screen.getByRole("button", { name: /unmute block 01/i })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Patch block 01" }));
    expect(screen.getByText("Clock in — sources add up")).toBeInTheDocument();
  });

  it("turns a block into an Euclidean Bernoulli voice router", () => {
    vi.spyOn(window.localStorage.__proto__, "getItem").mockReturnValue(null);
    render(<App />);
    fireEvent.change(screen.getAllByLabelText("Block type or voice for block 01")[0], { target: { value: "bernoulli" } });
    const block = screen.getAllByTestId("block-1")[0];
    expect(within(block).getByTitle("Euclidean A/B voice router")).toHaveTextContent("A/B");
    expect(within(block).getByText("A Kick / B Snare")).toBeInTheDocument();
    fireEvent.click(within(block).getByRole("button", { name: "Patch block 01" }));
    expect(screen.getByLabelText("Output A voice")).toHaveValue("kick");
    expect(screen.getByLabelText("Output B voice")).toHaveValue("snare");
    fireEvent.change(screen.getByLabelText("Output A voice"), { target: { value: "snare" } });
    expect(screen.getByLabelText("Output A voice")).toHaveValue("snare");
    expect(screen.getByLabelText("Output B voice")).toHaveValue("kick");
    expect(within(block).getByText("A chance")).toBeInTheDocument();
    expect(screen.getByText(/Every filled Euclidean step routes to A/)).toBeInTheDocument();
  });

  it("loads a factory preset from the transport dropdown", () => {
    vi.spyOn(window.localStorage.__proto__, "getItem").mockReturnValue(null);
    render(<App />);
    fireEvent.change(screen.getByLabelText("Drum pattern preset"), { target: { value: "boom-bap" } });
    expect(screen.getByLabelText("Drum pattern preset")).toHaveValue("boom-bap");
    expect(screen.getByLabelText("Beats per minute")).toHaveValue("90");
    expect(within(screen.getByRole("group", { name: "Song arrangement" })).getAllByRole("button")).toHaveLength(5);
    expect(screen.getByRole("button", { name: "Song part 1: pattern A, 4 bars" })).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("button", { name: "Song part 1: pattern A, 4 bars" })).toHaveStyle({ flexBasis: "60px" });
    expect(screen.getByRole("button", { name: "Song part 4: pattern D, 2 bars" })).toHaveStyle({ flexBasis: "46px" });
    expect(screen.getByRole("button", { name: "Song" })).toHaveAttribute("aria-pressed", "true");
  });

  it("syncs valid files into a grouped preset menu, loads them, and saves changes", async () => {
    vi.spyOn(window.localStorage.__proto__, "getItem").mockReturnValue(null);
    const preset = createArrangement({ ...createDemoPatch(), bpm: 137 });
    const write = vi.fn();
    const close = vi.fn();
    const file = {
      kind: "file",
      name: "Night Drive.json",
      getFile: async () => ({ text: async () => JSON.stringify(preset) }),
      createWritable: async () => ({ write, close }),
    } as unknown as FileSystemFileHandle;
    const directory = {
      kind: "directory",
      name: "My Beats",
      async *entries() { yield [file.name, file] as [string, FileSystemFileHandle]; },
      resolve: async () => [file.name],
    } as unknown as FileSystemDirectoryHandle;
    const openPicker = vi.fn().mockResolvedValue([file]);
    Object.defineProperties(window, {
      showDirectoryPicker: { configurable: true, value: vi.fn().mockResolvedValue(directory) },
      showOpenFilePicker: { configurable: true, value: openPicker },
      showSaveFilePicker: { configurable: true, value: vi.fn().mockResolvedValue(file) },
    });

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Load" }));
    await waitFor(() => expect(screen.getByLabelText("Beats per minute")).toHaveValue("137"));
    expect(openPicker).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole("button", { name: "Sync folder" }));

    const option = await screen.findByRole("option", { name: "Night Drive" });
    expect(option.closest("optgroup")).toHaveAttribute("label", "Local · My Beats");
    fireEvent.change(screen.getByLabelText("Drum pattern preset"), { target: { value: "local:Night%20Drive.json" } });
    await waitFor(() => expect(screen.getByLabelText("Beats per minute")).toHaveValue("137"));

    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(write).toHaveBeenCalledWith(expect.stringContaining('"format": "euclid-grid.arrangement.v12"')));
    expect(close).toHaveBeenCalledOnce();
  });

  it("locks individual, block and global randomization controls", () => {
    vi.spyOn(window.localStorage.__proto__, "getItem").mockReturnValue(null);
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Lock Steps in block 01" }));
    expect(screen.getByRole("button", { name: "Unlock Steps in block 01" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Randomize Steps in block 01" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Lock all settings in block 01" }));
    expect(screen.getByRole("button", { name: "Randomize block 01" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Lock all" }));
    expect(screen.getByRole("button", { name: "Unlock all" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Shuffle" })).toBeDisabled();
  });

  it("undoes and redoes edits from controls and keyboard shortcuts", () => {
    vi.spyOn(window.localStorage.__proto__, "getItem").mockReturnValue(null);
    render(<App />);
    const undoButton = screen.getByRole("button", { name: "Undo last change" });
    const redoButton = screen.getByRole("button", { name: "Redo last change" });
    expect(undoButton).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Mute block 01" }));
    expect(undoButton).toBeEnabled();
    fireEvent.click(undoButton);
    expect(screen.getByRole("button", { name: "Mute block 01" })).toBeInTheDocument();
    expect(redoButton).toBeEnabled();
    fireEvent.keyDown(document, { key: "y", ctrlKey: true });
    expect(screen.getByRole("button", { name: "Unmute block 01" })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "z", ctrlKey: true });
    expect(screen.getByRole("button", { name: "Mute block 01" })).toBeInTheDocument();
  });

  it("mutes and unmutes the whole voice bank as one undoable change", () => {
    vi.spyOn(window.localStorage.__proto__, "getItem").mockReturnValue(null);
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Mute all" }));
    expect(screen.getAllByRole("button", { name: /Unmute .+ voice/ })).toHaveLength(14);
    fireEvent.click(screen.getByRole("button", { name: "Undo last change" }));
    expect(screen.getAllByRole("button", { name: /Mute .+ voice/ })).toHaveLength(14);
    fireEvent.click(screen.getByRole("button", { name: "Redo last change" }));
    expect(screen.getByRole("button", { name: "Unmute all" })).toHaveAttribute("aria-pressed", "true");
  });

  it("enables a specialized custom voice editor from the third model option", () => {
    vi.spyOn(window.localStorage.__proto__, "getItem").mockReturnValue(null);
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Use custom Kick" }));
    const settings = screen.getByRole("button", { name: "Configure custom Kick" });
    expect(settings).toBeInTheDocument();
    fireEvent.click(settings);

    expect(screen.getByRole("dialog")).toHaveTextContent("Kick synthesizer");
    expect(screen.getByLabelText("Kick Body frequency")).toHaveValue("50");
    expect(screen.getByLabelText("Kick Pitch sweep")).toBeInTheDocument();
    expect(screen.queryByLabelText("Kick Tone spread")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Kick Body frequency"), { target: { value: "64" } });
    expect(screen.getByLabelText("Kick Body frequency value")).toHaveValue(64);

    fireEvent.click(screen.getByRole("button", { name: "Close dialog" }));
    fireEvent.click(screen.getByRole("button", { name: "Use 808 Kick" }));
    expect(screen.queryByRole("button", { name: "Configure custom Kick" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Use 909 Kick" }));
    fireEvent.click(screen.getByRole("button", { name: "Use custom Kick" }));
    fireEvent.click(screen.getByRole("button", { name: "Configure custom Kick" }));
    expect(screen.getByLabelText("Kick Body frequency")).toHaveValue("64");
  });

  it("configures shared effects and independent voice sends as undoable changes", async () => {
    vi.spyOn(window.localStorage.__proto__, "getItem").mockReturnValue(null);
    render(<App />);
    const effectsButton = screen.getByRole("button", { name: "Open effects mixer, 1 effect enabled" });
    fireEvent.click(effectsButton);

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("Effects mixer");
    fireEvent.click(within(dialog).getByRole("button", { name: "Enable distortion" }));
    fireEvent.change(within(dialog).getByLabelText("Kick Distortion send"), { target: { value: "64" } });
    expect(within(dialog).getByLabelText("Kick Distortion send")).toHaveValue("64");
    expect(within(dialog).getByRole("button", { name: "Disable distortion" })).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(within(dialog).getByRole("button", { name: "Close dialog" }));
    expect(screen.getByRole("button", { name: "Open effects mixer, 2 effects enabled" })).toHaveClass("has-active-effects");
    fireEvent.click(screen.getByRole("button", { name: "Undo last change" }));
    fireEvent.click(screen.getByRole("button", { name: "Open effects mixer, 2 effects enabled" }));
    expect(screen.getByLabelText("Kick Distortion send")).toHaveValue("0");
  });
});

describe("variations and song mode", () => {
  it("duplicates a variation, keeps edits isolated and highlights changes from A", () => {
    vi.spyOn(window.localStorage.__proto__, "getItem").mockReturnValue(null);
    render(<App />);
    expect(screen.getByTitle("Variation A")).toHaveAttribute("aria-selected", "true");
    fireEvent.click(screen.getByRole("button", { name: "Add variation" }));
    const variationB = screen.getByTitle("Variation B");
    expect(variationB).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(within(screen.getByTestId("block-1")).getByRole("button", { name: "Steps: 16" }), { key: "ArrowDown" });
    expect(screen.getByTestId("block-1")).toHaveClass("has-variation-change");
    expect(within(screen.getByTestId("block-1")).getByRole("button", { name: "Steps: 15" }).closest(".parameter-row")).toHaveClass("variation-changed");
    expect(variationB).toHaveClass("has-changes");

    fireEvent.click(screen.getByTitle("Variation A"));
    expect(within(screen.getByTestId("block-1")).getByRole("button", { name: "Steps: 16" })).toBeInTheDocument();
    expect(screen.getByTestId("block-1")).not.toHaveClass("has-variation-change");
    fireEvent.click(screen.getByTitle("Variation B has changes from A"));
    expect(within(screen.getByTestId("block-1")).getByRole("button", { name: "Steps: 15" })).toBeInTheDocument();
  });

  it("reuses patterns as independent song parts and advances by each part's length", () => {
    vi.spyOn(window.localStorage.__proto__, "getItem").mockReturnValue(null);
    let onBar: (() => void) | null = null;
    vi.spyOn(SequencerEngine.prototype, "setBarCallback").mockImplementation((callback) => { onBar = callback; });
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Add variation" }));
    fireEvent.click(screen.getByTitle("Variation A"));
    fireEvent.click(screen.getByRole("button", { name: "Song" }));
    expect(screen.getByRole("button", { name: "Song" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Lengthen song part" }));
    expect(screen.getByLabelText("Length for song part 1")).toHaveTextContent("2 bars");
    fireEvent.click(screen.getByRole("button", { name: "Add pattern A to song" }));
    expect(screen.getByRole("button", { name: "Song part 2: pattern A, 1 bar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Song part 3: pattern B, 1 bar" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Song part 1: pattern A, 2 bars" }));

    act(() => onBar?.());
    expect(screen.getByRole("button", { name: "Song part 1: pattern A, 2 bars" })).toHaveAttribute("aria-current", "true");
    act(() => onBar?.());
    expect(screen.getByRole("button", { name: "Song part 2: pattern A, 1 bar" })).toHaveAttribute("aria-current", "true");
    act(() => onBar?.());
    expect(screen.getByRole("button", { name: "Song part 3: pattern B, 1 bar" })).toHaveAttribute("aria-current", "true");
  });

  it("reorders song parts by drag and keyboard without growing the toolbar", () => {
    vi.spyOn(window.localStorage.__proto__, "getItem").mockReturnValue(null);
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Add variation" }));
    fireEvent.click(screen.getByRole("button", { name: "Song" }));
    const partA = screen.getByRole("button", { name: "Song part 1: pattern A, 1 bar" });
    const partB = screen.getByRole("button", { name: "Song part 2: pattern B, 1 bar" });
    const dataTransfer = { effectAllowed: "none", dropEffect: "none", setData: vi.fn(), getData: vi.fn(() => "") };
    fireEvent.dragStart(partB, { dataTransfer });
    fireEvent.drop(partA, { dataTransfer });
    expect(within(screen.getByRole("group", { name: "Song arrangement" })).getAllByRole("button")[0]).toHaveAccessibleName("Song part 1: pattern B, 1 bar");
    fireEvent.keyDown(screen.getByRole("button", { name: "Song part 1: pattern B, 1 bar" }), { key: "ArrowRight", altKey: true });
    expect(within(screen.getByRole("group", { name: "Song arrangement" })).getAllByRole("button")[0]).toHaveAccessibleName("Song part 1: pattern A, 1 bar");
  });
});

describe("patch bay", () => {
  it("undoes and redoes additional modulation targets without changing existing routes", () => {
    vi.spyOn(window.localStorage.__proto__, "getItem").mockReturnValue(null);
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Patch block 03" }));
    fireEvent.click(screen.getByRole("button", { name: "Add modulation target" }));
    expect(screen.getByLabelText("Modulation source for fill")).toHaveValue("12");
    fireEvent.click(screen.getByRole("button", { name: "Undo last change" }));
    expect(screen.queryByLabelText("Modulation source for fill")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Modulation source for chance")).toHaveValue("12");
    fireEvent.click(screen.getByRole("button", { name: "Redo last change" }));
    expect(screen.getByLabelText("Modulation source for fill")).toHaveValue("12");
  });

  it("highlights connected blocks, edits routing and follows a connection", () => {
    vi.spyOn(window.localStorage.__proto__, "getItem").mockReturnValue(null);
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Patch block 03" }));
    expect(screen.getByTestId("block-13")).toHaveClass("is-related");
    expect(screen.getByLabelText("Modulation source for chance")).toHaveValue("12");
    fireEvent.change(screen.getByLabelText("Modulation source for chance"), { target: { value: "13" } });
    expect(screen.getByTestId("block-14")).toHaveClass("is-related");
    expect(screen.getByTestId("block-13")).not.toHaveClass("is-related");
    fireEvent.click(screen.getByRole("button", { name: "Block 14 LFO to block 03 chance" }));
    expect(screen.getByRole("region", { name: "Routing for block 14" })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("region", { name: /Routing for block/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Patch block 14" })).toHaveFocus();
  });
});

describe("circle view", () => {
  it("selects just one rhythm, edits it, and preserves changes when switching views", () => {
    vi.spyOn(window.localStorage.__proto__, "getItem").mockReturnValue(null);
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Circle" }));
    expect(screen.getAllByTestId(/^orbit-ring-/)).toHaveLength(16);
    expect(screen.getAllByTestId(/^block-/)).toHaveLength(1);
    expect(screen.getAllByTestId(/^orbit-playhead-/)).toHaveLength(4);
    fireEvent.click(screen.getByRole("button", { name: "Select block 02 Snare" }));
    const settings = screen.getByRole("region", { name: "Settings for block 02" });
    fireEvent.keyDown(within(settings).getByRole("button", { name: "Steps: 16" }), { key: "ArrowDown" });
    expect(within(settings).getByRole("button", { name: "Steps: 15" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Grid" }));
    expect(screen.getAllByTestId(/^block-/)).toHaveLength(16);
    expect(within(screen.getByTestId("block-2")).getByRole("button", { name: "Steps: 15" })).toBeInTheDocument();
    expect(within(screen.getByTestId("block-1")).getByRole("button", { name: "Steps: 16" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Circle" }));
    expect(screen.getByRole("region", { name: "Settings for block 02" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Undo last change" }));
    expect(screen.getByRole("button", { name: "Steps: 16" })).toBeInTheDocument();
  });

  it("supports ring selection, arrow navigation and following a patched connection", () => {
    vi.spyOn(window.localStorage.__proto__, "getItem").mockReturnValue(null);
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Circle" }));
    fireEvent.click(screen.getByTestId("orbit-ring-2"));
    expect(screen.getByRole("region", { name: "Settings for block 03" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Block 13 LFO to block 03 chance" }));
    expect(screen.getByRole("region", { name: "Settings for block 13" })).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("button", { name: "Select block 13 Modulator" }), { key: "ArrowRight" });
    expect(screen.getByRole("button", { name: "Select block 14 Modulator" })).toHaveFocus();
    expect(screen.getByRole("region", { name: "Settings for block 14" })).toBeInTheDocument();
    expect(within(screen.getByRole("group", { name: "Select a rhythm" })).getAllByRole("button", { pressed: true })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Voice bank" }));
    expect(screen.getByRole("button", { name: "Mute all" })).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("orbit-ring-0"));
    expect(screen.getByRole("region", { name: "Settings for block 01" })).toBeInTheDocument();
  });

  it("does not stop or restart playback when switching views", async () => {
    vi.spyOn(window.localStorage.__proto__, "getItem").mockReturnValue(null);
    let running = false;
    const start = vi.spyOn(SequencerEngine.prototype, "start").mockImplementation(async () => { running = true; });
    const stop = vi.spyOn(SequencerEngine.prototype, "stop");
    vi.spyOn(SequencerEngine.prototype, "running", "get").mockImplementation(() => running);
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Stop" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Circle" }));
    fireEvent.click(screen.getByRole("button", { name: "Grid" }));
    expect(start).toHaveBeenCalledTimes(1);
    expect(stop).not.toHaveBeenCalled();
  });
});
