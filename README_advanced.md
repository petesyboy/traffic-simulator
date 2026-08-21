# Gigamon Flow Map Simulator — Systems Engineer (SE) Reference Guide

Welcome to the SE edition of the **Gigamon Fabric Manager & Flow Map Simulator** documentation. This reference guide outlines both Simple Mode and Advanced Mode (Physical Hardware configurations) including technical logic, optical resolution engines, validation constraints, and Bill of Materials (BOM) engine behaviours.

---

## 1. System Architectures & Modes

The simulator supports two runtime visualisation modes, toggleable via the header menu:

### A. Simple Mode (Logical Flow Map)
Designed for high-level logical path mapping. Nodes represent logical objects:
- **SPAN Port / TAP Device**: Abstract traffic sources.
- **Traffic Maps & Filters**: Route and select traffic streams matching VLAN, IP version, IP subnets, or port values.
- **GigaSMART Engines**: Deduplication, slicing, header stripping, GTP correlation, SSL decrypt, and load balancing (includes dynamic duplicate drop rate drift animations).
- **Target Tools**: Security and compliance tools categorised as Packet-consuming, Metadata-consuming, or Storage-oriented.

### B. Advanced Mode (Physical Hardware Design)
Transitions the canvas to a physical hardware configuration layout. Users place actual chassis models, physical TAP modules, breakout panels, configure power supplies, and inspect real-time interface metrics:
- **Real-time Metrics**: Displays live throughput parameters directly on physical hardware nodes (`In: X.X Gbps` / `Out: X.X Gbps`).
- **Input Node Aggregation**: TAPs and input nodes on the far-left summarise total ingress bandwidth.
- **Photographic Hardware Diagrams**: HC1, HC1-Plus, HC3, and HCT chassis nodes render an actual front-panel photo with whichever port/GigaSMART/bypass modules you have installed composited at their real physical slot position — not a generic box.
- **Front-Panel Optic Occupancy Overlays**: Real-time optic occupancy markers overlay directly onto front-panel photography for HC1, HC1-Plus, and HC3 chassis. Color-blind accessible blue badges with checkmarks highlight fitted cages with exact pixel-level alignment.
- **Hardware Summary Panel**: Click the 📋 icon in a chassis node's header to open a full-size hardware summary with a slot legend, live port state, and installed board/optic details.
- **Collapsible Board Details**: Click the **−/+** icon next to 📋 to collapse the photo/port-map section down to just the header when managing dense multi-board layouts.
- **Tidy Layout Auto-Arrangement**: Click the **Tidy Layout** button on the canvas toolbar to instantly auto-align complex topologies into structured, presentation-ready columns (Sources → TAPs/Aggregation → Maps/GigaSMART → Target Tools).
- **Multi-Site Architecture**: Assign hardware appliances and target tools to distinct physical sites (e.g. Primary DC, Secondary DC, Branch). Enables site-specific BOM filtering and scoped rack elevation.

### C. Toggling Modes (4-Click Gigamon Logo Toggle)
- **4-Click Logo Toggle**: Click the **Gigamon logo** in the top-left corner of the header **four times in quick succession** to switch between **Standard View** and **Expert Designer** (Advanced Mode).
- **Unlocked Features in Advanced Mode**:
  - **Bill of Materials (BOM)**: The **BOM** tab appears in the top header bar, enabling real-time physical hardware inventory, exact SKU resolution, multipack rollups, and optional pricing breakdown.
  - **Hardware Categories**: The left sidebar expands to reveal physical **Traffic Aggregation (TAs)** appliances, **Optical TAPs**, **Breakout Panels**, and **GigaVUE-HC Series Chassis**.
  - **Detailed Hardware Configuration**: Selecting any hardware node opens advanced configuration side panels to manage board module slots, transceiver cages, licence capacity, and power/battery accessories.

---

## 2. BOM Engine & Licensing Logic

The Bill of Materials (BOM) is dynamically generated under the **BOM** tab based on canvas configuration and connection paths:

1. **Licensing Modes**:
   - **Perpetual**: Lists hardware chassis, ports, base software, and perpetual licences.
   - **HTL (Hybrid Trial/Term License)**: Incorporates term duration multipliers (e.g., 36 months) for term-based GigaSMART and core licences.
2. **SKU Matching & Card-Level GigaSMART Licensing**:
   - Matches GigaSMART software licences (e.g. `SMT-HC1P-GEN3-DD1-SW-TM` for GigaVUE-HC1 Plus) and maps them explicitly as **licences** (not "modules") in the BOM.
   - Models advanced combined licensing rules for FlowVUE, GTP Whitelisting, GTP Flow Sampling, and GTP Flow Filtering, deduplicating card-level requirements so implied dependencies are never double-billed.
   - Automatically appends upgrading SKU suffixes for chassis capacity configurations (e.g., TA400 capacity licence upgrades).
3. **Double Optic Rule**:
   - Because network traffic is northbound and southbound, every connected link requires two optics (e.g., SFP/QSFP) on the chassis side. The BOM engine automatically doubles the optic quantity for connected ports.
4. **Optic Multipack Optimisations**:
   - Large quantities of identical transceivers automatically roll up into cost-effective multipack SKUs (e.g. 10-packs, 8-packs, 4-packs) on the BOM, accompanied by transparent surplus notes.
5. **Standalone Device Consolidation**:
   - Standalone devices and single-line BOM items roll up cleanly on the Site tab for streamlined procurement review.
6. **Historical SKU Knowledge Base**:
   - Retains a persistent knowledge base of legacy and unlisted SKUs. If a topology contains older modules or optics omitted from current price lists, they are flagged as "Discontinued / Unavailable" with replacement guidance rather than silently failing.
7. **Site Consistency Verification**:
   - When generating the BOM or PDF reports from a multi-site project, a verification modal alerts users if any devices lack explicit site assignments, preventing accidental quote discrepancies.

---

## 3. Optical Auto-Suggestions, Validation & Link Resolution Engine

To ensure proper hardware connectivity, the simulator performs real-time interface validation and automated repair:

1. **One-Click Link Diagnostic & Resolution ("Resolve Connection Problem")**:
   - Selecting any link opens the **Link Detail Panel**, displaying connected transceiver SKUs, media speeds, and port roles.
   - If transceivers are missing, mismatched in speed, or unassigned, a diagnostic alert appears with a one-click **"Resolve Connection Problem"** action.
   - Automatically fits matching optics to both ends, syncs the chassis inventory, and updates the port map.
2. **Intelligent Speed Upgrading**:
   - When resolving link mismatches, the resolution engine upgrades the lower-speed peer to match the higher-speed optic (e.g. upgrading a 1G optic to 10G/25G) rather than downgrading the link.
3. **TAA-Compliant Optics Preference**:
   - Transceiver auto-assignment and link resolution always default to TAA-compliant (`-T` suffix) optic variants whenever supported by the chassis.
4. **TAP Fiber Mode Validation**:
   - Checks that the connected interface fiber matches (Singlemode vs Multimode). Flags a mismatch warning if there is a conflict.
5. **Breakout Panels & MPO Fan-Out**:
   - Single-mode and multi-mode breakout panels (`PNL-M341`, `PNL-M343`) model MPO-to-LC fan-outs (e.g. 1 QSFP cage → 4 SFP lanes).
   - Breakout panels consume one bay slot inside a `TAP-M100T` (3 slots) or `TAP-M200T` (6 slots) tray alongside optical TAPs, properly factored into tray bin-packing math.
6. **Forced TAP-M506T Constraint**:
   - Connecting a **TAP-M506T** module to a GigaVUE chassis automatically suggests and locks the target optic to **`QSB-523T (40/100G QSFP28 Dual-Rate BiDi)`**.

---

## 4. Power Supply & Regional Settings

When a physical chassis or active TAP is selected, configure power supply and regional settings:

1. **Regional Flag Selection**:
   - Click the flag icon in the top header menu to switch between **US**, **EU**, and **UK** deployment regions.
   - Changing the region automatically updates the default AC power cord SKUs across all appliances and active TAPs in the project:
     - **US**: `PCD-00A21` (US Power Cord)
     - **EU**: `PCD-00A23` (EU Power Cord)
     - **UK**: `PCD-00A25` (UK Power Cord)
2. **AC Power**:
   - Automatically assigns power cords matching the active **Project Region**.
3. **DC Power**:
   - Assigns DC wiring terminals instead of regional wall cords with safety reminders (*"DC wiring must be terminated by a certified electrician."*).
4. **Active TAP Power & Battery Accessories**:
   - Active TAPs (`G-TAP A-SF2`, `G-TAP A-TX2`) support redundant power bricks (`PBK-GTA21`), battery backup modules (`BAT-GTA20`), and extra power cords in the configuration panel.

---

## 5. Advanced Routing & Storage Filtering

1. **GigaStream Load Balancing**:
   - Configure GigaStream link counts with mismatch warning badges if the physical link count diverges.
   - Routes streams dynamically: **Round Robin** splits bandwidth evenly, while **L4 Hash** hashes the five-tuple header (IPs, ports, protocol) to route the full stream down a single selected link.
2. **Storage Tool Suppression (AMI / Metadata)**:
   - When a GigaSMART app generates metadata (e.g. Application Metadata / AMI) on a chassis connected to S3 Object Storage, raw packet streams are suppressed. S3 receives only the lightweight metadata stream (~5% throughput), preventing storage flooding.

---

## 6. Comprehensive PDF Solution Reports & Physical Deployment Specifications

Advanced Mode includes a PDF report generator (**Report** button in the header) producing client-ready documentation:

1. **Executive Summary with Markdown**:
   - Includes editable executive summaries supporting rich Markdown formatting (bold, lists, headers).
2. **Visual Topology & Chassis Capture**:
   - Automatically renders high-resolution captures of the active canvas topology and photographic chassis front panels directly into the PDF.
3. **Appendix B: Physical Deployment & Environmental Specifications**:
   - Renders comprehensive per-site breakdowns and master aggregated deployment tables covering:
     - Rack Units (RU)
     - Physical dimensions (Height × Width × Depth in mm and inches)
     - Unit weights (kg and lbs)
     - Typical and maximum power consumption (Watts)
     - Heat dissipation (BTU/hr)
     - Airflow direction (Front-to-Back, Side-to-Side)
4. **Tool Ingest Advisory Notice**:
   - Displays an advisory notice clarifying that rated sensor throughputs are baseline simulation benchmarks, encouraging verification of exact sustained/peak limits with tool manufacturers.

---

## 7. Solution Management & Presentation Mode

1. **Solution Naming & Save Slots**:
   - Click the solution title in the top header bar to rename the project.
   - Use multi-slot browser storage or JSON file Export/Import to save and share complete topologies.
2. **Presentation Focus Mode**:
   - Double-clicking any node on the canvas highlights it with a pulsing orange halo (`.node-presentation-glow`). Double-clicking again or clicking the canvas background clears the highlight.

---

## 8. Rack Elevation View

Physical **Rack Elevation View** (**Canvas View ↔ Rack View**) models hardware layout inside a standard 42U rack:

1. **Real Chassis Photos**: Racked units render real product photography with installed modules composited at their exact physical slot positions and accurate RU heights.
2. **Placing Hardware**: Drag any hardware node from the site-scoped **"Unracked Hardware"** list onto an empty U position. Click **✕** on a racked unit to unrack it.
3. **Automatic TAP Trays**: TAP-M100T (3 bays), TAP-M200T (6 bays), and TAP-M202ULT (2 bays) trays generate automatically based on physical tap module count and breakout panels using bin-packing math.
4. **Nesting Tap Modules & Breakout Panels**: Drag tap modules and breakout panels into tray bay slots. Unracking a tray safely returns nested modules to the unracked pool.
5. **BOM Independence**: Rack layout is visual and spatial; BOM quantities remain strictly driven by required physical capacity.
