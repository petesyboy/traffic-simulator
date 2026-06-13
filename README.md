# Gigamon Fabric Manager & Flow Map Simulator

Welcome to the **Gigamon Fabric Manager & Flow Map Simulator**, an interactive visual orchestration tool built with React, TypeScript, React Flow, and Zustand. This application models a physical Gigamon H-Series Fabric Manager deployment, letting users visually configure network visibility pipelines, simulate real-time traffic throughput, generate CLI configuration scripts, and inspect flow validation rules.

---

## Key Features

1. **Interactive Node Canvas**: Drag-and-drop network elements (SPAN, TAP, ERSPAN), Traffic Maps, Filters, GigaSMART engines (Deduplication, Slicing, SSL Decryption, etc.), Load Balancers, and target Security/Monitoring tools.
2. **Auto-Generated Live Traffic**: Dragging any traffic source node onto the canvas automatically spawns a live traffic stream (1-100 Gbps bandwidth) with random IP, VLAN, and protocol data.
3. **Live GigaSMART Deduplication Drift**: Deduplication nodes on the canvas dynamically drift their duplicate drop rate between `10%` and `50%` in real time, rendering the current rate directly onto the canvas node icon.
4. **Flow Validation & Warnings**: Validates traffic paths dynamically. E.g., alerts are flagged if a Packet Tool (like Vectra) receives metadata instead of raw packets, or if a SIEM tool (like Splunk) receives format mismatches.
5. **Port Grouping**: Group multiple traffic sources together inside a Port Group node. Connecting the group container to a Traffic Map aggregates all nested source interfaces.
6. **H-Series CLI Script Compiler**: Generates exact Gigamon H-Series CLI script files in real time as you configure maps, filters, and port destinations.
7. **Real-time Status Drawer**: Tracks and badges each traffic stream as `✓ Passed`, `❌ Filtered`, or `Idle` based on active path deliveries.
8. **Collapsible Config Panel**: Slide the properties panel off the screen to make more room on the canvas, with intelligent auto-expansion when a node is selected.

---

## Local Setup & Development

To run the simulator locally, follow these steps:

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Run Development Server**:
   ```bash
   npm run dev
   ```
   Open `http://localhost:5173` in your web browser.

3. **Verify Styles and Types (Linter)**:
   ```bash
   npm run lint
   ```

4. **Build Production Bundle**:
   ```bash
   npm run build
   ```

---

## Step-by-Step Guide: Configuring a Flow Map

Here is how to set up a basic flow map that routes mirror traffic through a GigaSMART deduplication engine to a Vectra security sensor:

### Step 1: Add a Traffic Source

1. Look at the left sidebar under the **"Demonstration"** section.
2. Drag a **SPAN Port** (or a **TAP Device**) and drop it onto the canvas grid.
3. You will immediately see a new port allocated (e.g., `1/1/x1`).
4. In the bottom **Traffic Generator** drawer, note that a new live traffic stream has been generated automatically with a random bandwidth between 1 and 100 Gbps (e.g., `52.4 Gbps`).

### Step 2: Add a Basic Traffic Map

1. In the left sidebar, find the **"Traffic Map"** node.
2. Drag and drop it onto the canvas.
3. Connect the right handle of your **SPAN Port** to the left handle of your **Traffic Map**.
4. *(Optional)* Click on the Traffic Map node in the properties panel. Click **"+ Add Match Condition"** and choose options like `VLAN ID` (e.g., `100`) or `IP Version` (`IPv4` or `IPv6`) to restrict what traffic is allowed through the map.

### Step 3: Add a Deduplication GigaSMART Transformation

1. From the left sidebar, drag a **GigaSMART** node and drop it onto the canvas.
2. Connect the right handle of your **Traffic Map** to the left handle of your **GigaSMART** node.
3. Click on the GigaSMART node in the properties panel. Set the **GigaSMART Engine Operation** to **"De-duplication (Adaptive)"**.
4. You will see a bold percentage text overlay (e.g., `35%`) appear on the canvas node. If you start the simulation (via **▶ Run Simulation** in the top header), this value will drift dynamically by `+/- 5%` every few seconds, reducing downstream traffic volume proportionally.

### Step 4: Output to a Vectra Sensor

1. In the left sidebar under **"Packet Tools"**, find the **Vectra** sensor.
2. Drag and drop it onto the canvas.
3. Connect the right handle of the **GigaSMART** deduplication node to the left handle of the **Vectra** node.
4. Click **"▶ Run Simulation"** in the top menu bar.
5. **Verify Path Flow**:
   - The connection lines will light up with moving traffic animations.
   - The Vectra node will display a green status badge indicating it is successfully receiving raw packets.
   - In the bottom Traffic Generator drawer, the status column for your active traffic stream will update to a green `✓ Passed` badge, showing it has successfully arrived at its destination.
