# Gigamon Fabric Manager & Flow Map Simulator

Welcome to the **Gigamon Fabric Manager & Flow Map Simulator**, an interactive visual orchestration tool built to easily demonstrate how network visibility pipelines are designed and modeled.

This application allows sales teams to quickly build flow maps, simulate live traffic throughput, and visually explain Gigamon's value proposition to customers.

---

## 🎯 60-Second Demo Script (Start Here)

The simulator loads with a ready-made scenario, so you can walk straight into the story without configuring anything. Here's the flow:

1. **Load the page and reset the demo.** Click the reset icon in the top-right of the toolbar to load the default layout.
2. **Start with connectivity.** On the left you'll see six traffic sources — five TAPs and a SPAN port. The ExtraHop appliance can't take six direct inputs on its own, so notice how Gigamon's **Core Traffic Map** aggregates all six sources into a single, clean feed it *can* accept. That's the first problem Gigamon solves: connectivity.
3. **Click "▶ Run Simulation."** Traffic starts flowing, and the ExtraHop node immediately flags itself as overloaded — it's rated for 100 Gbps, but it's currently receiving over that.
4. **Click the Core Traffic Map**, then find the VLAN rule in the panel on the right. Remove **VLAN 999** — that's traffic which shouldn't be reaching ExtraHop in the first place. Traffic drops back under the 100 Gbps limit. While the simulation is running, the Traffic Map node itself shows both **In:** (everything the TAPs are feeding it) and **Out:** (what's left after the rule) side by side, so the effect of the change is visible on the node itself.
5. **Add deduplication.** Drag **Deduplication** from the sidebar and drop it directly onto the connection between the Core Traffic Map and ExtraHop. Watch the duplicate-traffic percentage reduce the load even further.
6. **Click an empty area of the canvas** to close the side panel, then let the simulation keep running. With nothing selected, the full canvas is on display and the live throughput numbers tell the rest of the story: Gigamon delivered exactly the traffic the tool needed — no more, no less — without anyone touching the tool itself.

---

## Key Features (Sales Demo)

1. **Interactive Node Canvas**: Drag-and-drop network elements (SPAN Port, TAP Device), Traffic Maps, Filters (VLAN, Subnet, Port), GigaSMART engines (Deduplication, Slicing), and target tools (Vectra, Splunk).
2. **Auto-Generated Live Traffic**: Dragging any traffic source node onto the canvas automatically spawns a live traffic stream with standard speeds (1G, 10G, 25G, 40G, 100G) and random packet parameters.
3. **Live GigaSMART Deduplication Drift**: Dedup nodes dynamically drift their duplicate drop rate between `10%` and `50%` in real time, showing visual validation of traffic reduction.
4. **Flow Validation & Warnings**: Visually alerts you if there is a traffic mismatch (e.g. metadata sent to a packet tool).
5. **Port Grouping**: Easily group multiple traffic sources together inside a Port Group container.
6. **Save/Load Slots**: Multi-slot layout storage allows naming and loading custom demo topology snapshots.
7. **Presentation Focus Mode**: Double-click any node to put a pulsing focus glow around it, making it easy to talk about specific components during a customer call.

---

## How to Run the Simulator

To run the simulator, simply locate the file named **`traffic-reduction-simulator.html`** (found in the root of this folder, or as `dist/index.html`, or on your desktop) and double-click to open it in any web browser. 

This standalone HTML file requires no server setup, installation, or internet access to run.

---

## Step-by-Step Demo Guide: Configuring a Flow Map

Here is how to set up a basic flow map that routes mirror traffic through a GigaSMART deduplication engine to a Vectra security sensor:

### Step 1: Add a Traffic Source
1. Look at the left sidebar under the **"Demonstration"** section.
2. Drag a **SPAN Port** and drop it onto the canvas grid.
3. You will immediately see a new port allocated (e.g., `1/1/x1`).

### Step 2: Add a Basic Traffic Map
1. Drag a **Traffic Map** node and drop it onto the canvas.
2. Connect the right handle of your **SPAN Port** to the left handle of your **Traffic Map**.

### Step 3: Add a Deduplication GigaSMART Engine
1. Drag **Deduplication** from the Applications sidebar section onto the canvas.
2. Connect the right handle of your **Traffic Map** to the left handle of your **Deduplication** node.
3. Note the percentage text overlay (e.g., `35%`) showing the duplicate traffic reduction.

### Step 4: Output to a Vectra Sensor
1. Under **"PACKET CONSUMING TOOLS"**, drag **Vectra** onto the canvas.
2. Connect the right handle of your **Deduplication** node to the left handle of your **Vectra** node.
3. Click **"▶ Run Simulation"** in the top menu bar to watch the live traffic streams flow!

---
<sub>Looking for Systems Engineer (SE) details or physical hardware configurations? See the [advanced reference guide](README_advanced.md).</sub>
