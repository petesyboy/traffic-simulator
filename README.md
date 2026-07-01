# Gigamon Fabric Manager & Flow Map Simulator

Welcome to the **Gigamon Fabric Manager & Flow Map Simulator**, an interactive visual orchestration tool built to easily demonstrate how network visibility pipelines are designed and modeled.

This application allows sales teams to quickly build flow maps, simulate live traffic throughput, and visually explain Gigamon's value proposition to customers.

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

## Local Setup & Development

To run the simulator locally:

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Run Development Server**:
   ```bash
   npm run dev
   ```
   Open `http://localhost:5173` in your web browser.

3. **Build Standalone Output**:
   ```bash
   npm run build
   ```
   Generates a standalone, inline-single-file build at `dist/dop_illustration.html`.

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
