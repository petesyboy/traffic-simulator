# Gigamon Flow Map Simulator — Systems Engineer (SE) Reference Guide

Welcome to the Systems Engineer (SE) reference guide for the **Gigamon Fabric Manager & Flow Map Simulator**. This documentation covers both **Simple Mode** (logical traffic flow mapping) and **Advanced Mode** (physical hardware topology design), including traffic source configuration, physical optical TAP architecture, Traffic Aggregator (TA) to GigaVUE-HC fabric interconnects, chassis-embedded GigaSMART pipelines, automated Bill of Materials (BOM) diagnostic resolution, partner-brandable report generation with Markdown and Glean AI, and offline application distribution.

---

## 1. System Architectures & Visualisation Modes

The simulator supports two primary runtime operational modes, toggleable via the top brand bar:

### A. Simple Mode (Logical Flow Map)
Designed for high-level architectural presentations, customer discovery conversations, and logical traffic reduction simulations:
- **Logical Ingress Nodes**: SPAN ports, abstract TAP feeds, East/West virtual feeds, and ERSPAN tunnel encapsulation sources.
- **Traffic Maps & Filters**: Route and filter traffic streams matching VLANs, IP versions (IPv4/IPv6), CIDR subnets, and L4 transport protocols/ports (TCP/UDP/ICMP).
- **Standalone GigaSMART Nodes**: Visualise inline and out-of-band traffic optimisation apps as individual pipeline blocks, including Deduplication (with live drop-rate drift animations), Packet Slicing, Header Stripping, GTP Correlation, SSL/TLS Decryption, and Application Metadata Intelligence (AMI).
- **Target Tools**: Security and compliance monitoring tools categorised as Packet-consuming (Wireshark, Zeek, Suricata), Metadata-consuming (Splunk, Elastic, QRadar), or Storage-oriented (S3, PCAP Storage).

### B. Advanced Mode (Physical Hardware Design)
Transitions the canvas into a high-fidelity physical engineering environment:
- **Photographic Front-Panel Views**: GigaVUE-HC1, HC1-Plus, HC2, HC3, and HCT chassis render true-to-scale front-panel photography with installed line cards, GigaSMART blades, and bypass modules composited into their exact physical slot positions.
- **Front-Panel Optic Occupancy Badges**: Active optical transceivers overlay directly onto front-panel photography with colour-coded, accessible badges indicating occupied cages.
- **Real-Time Interface Throughput**: Displays live ingress and egress metrics directly on hardware nodes (`In: X.X Gbps` / `Out: X.X Gbps`).
- **Input Node Aggregation**: TAPs and input feeds calculate total aggregated ingress throughput.
- **Hardware Inspector Panel**: Click the 📋 icon in a chassis header or select the node to open a full-size hardware summary featuring slot legends, port states, installed blades, and power supply configurations.
- **Tidy Layout Engine**: Click the **Tidy Layout** button on the canvas toolbar to instantly auto-align complex multi-tier topologies into clean architectural columns (Sources → TAPs/Aggregation → Maps/GigaSMART → Target Tools).
- **Multi-Site Architecture**: Organise nodes into distinct physical datacentres (e.g. *Primary DC*, *Secondary DC*, *Branch Office*) for site-scoped BOMs and rack elevations.

### C. Unlocking Advanced Mode (The 4-Click Logo Toggle)
Advanced Mode is unlocked through a deliberate SE toggle in the user interface:

1. **How to Switch**: Locate the **Gigamon logo** in the top-left corner of the header bar. **Click the logo four times in rapid succession** (within 2 seconds).
2. **Visual Confirmation**:
   - The top navigation badge toggles from the white **"Standard View"** badge to the vibrant orange **"Expert Designer"** badge.
   - The left-hand elements palette automatically reorders, placing the **Physical Hardware (SE)** accordion at the very top.
3. **Unlocked Capabilities in Advanced Mode**:
   - **Physical Hardware Library**: Expands the component palette to include physical **Optical TAPs**, **Traffic Aggregators (TAs)**, **GigaVUE-HC Series Chassis**, and **Breakout Panels**.
   - **Embedded GigaSMART Pipelines**: Drops GigaSMART applications directly onto physical HC chassis rather than creating standalone logical nodes.
   - **BOM Auditing & Diagnostics**: Unlocks the header **BOM** button with real-time physical inventory, exact SKU resolution, multipack rollups, and pricing breakdowns.
   - **42U Rack Elevation View**: Unlocks the **Rack View** button to visualise physical equipment mounted into standard 42U datacentre cabinets with automated TAP tray bin-packing.
   - **Professional Deliverables Suite**: Unlocks the **Report** generator and native **Screenshot** export buttons.
   - **Hardware & Transceiver Side Panels**: Provides deep inspection of chassis silkscreen slots, transceiver cages, port licensing tiers, and redundant power supplies.

---

## 2. Ingress Traffic & Source Modelling

Accurately simulating network traffic volume and characteristics is fundamental to sizing Gigamon visibility fabrics.

### A. Creating & Configuring Traffic Sources
Traffic enters the visibility fabric via **Traffic Source** nodes or **Optical TAP** links:
1. **Adding Sources**: Drag a **Traffic Source / SPAN**, **Optical TAP**, or **ERSPAN Source** node from the left palette onto the canvas.
2. **Selecting Traffic Profiles**: In the node configuration panel, define the traffic type:
   - **Enterprise Web & Core TCP/UDP**: Typical enterprise mixture of web (HTTP/HTTPS), DNS, database, and internal applications.
   - **Mobile Core / 5G / LTE (GTP-U)**: Cellular carrier traffic containing encapsulated mobile subscriber data.
   - **Encrypted TLS / SSL**: Heavy cryptographic traffic intended for SSL Decryption sizing.
   - **VoIP & Real-Time Media (RTP/SIP)**: Latency-sensitive voice and video streams.
   - **Storage & Backup Replication**: High-volume, jumbo-frame bulk data transfers.
3. **Ingress Bandwidth Configuration**:
   - Set the raw throughput rate (e.g. `100 Mbps`, `1 Gbps`, `10 Gbps`, `40 Gbps`, `100 Gbps`).
   - Define average packet frame sizes (e.g. 64 bytes to 9000-byte Jumbo frames) to calculate live packets per second (Mpps).

### B. Downstream Propagation & GigaSMART Reduction
As traffic flows across canvas edges:
- **Baseline vs Peak Throughput**: Real-time traffic generators simulate bursty production conditions with natural mathematical drift.
- **Traffic Reduction Percentage**: GigaSMART apps dynamically calculate egress throughput savings (e.g. Deduplication removing 30–50% duplicate packets; Packet Slicing removing 70% payload weight; GTP Flow Sampling reducing 90% raw volume while retaining sampling fidelity).
- **Tool Capacity Sizing**: Visual indicators flag when aggregated tool streams exceed rated sensor ingest thresholds (e.g. delivering 12 Gbps to a 10 Gbps tool probe).

---

## 3. Optical TAPs & Physical Ingress Architecture

Gigamon optical TAPs provide non-intrusive, 100% passive, zero-packet-loss access to physical network links.

### A. Modular Optical TAPs & Unidirectional (ULT) Family
Passive modular TAPs sit inside rack-mounted trays:
- **M100T Tray**: 1RU tray supporting up to **3 TAP modules**.
- **M200T Tray**: 1RU high-density tray supporting up to **6 TAP modules**.
- **Supported Passive Optical TAP Modules**:
  - `TAP-M251`: 1G/10G Singlemode Fibre TAP (1310/1550nm, LC connectors).
  - `TAP-M253`: 1G/10G Multimode 50µm OM3/OM4 Fibre TAP (850nm, LC connectors).
  - `TAP-M501`: 40G/100G Singlemode Fibre TAP (MPO/LC).
  - `TAP-M506T`: 40G/100G Multimode BiDirectional (BiDi) Fibre TAP (specifically designed for Cisco/Arista BiDi infrastructure).
  - **G-TAP M Series Unidirectional TAP Family (ULT)**: `TAP-M251ULT`, `TAP-M253ULT`, `TAP-M271ULT`, `TAP-M273ULT`, etc., featuring true-to-life faceplate icons and hardware-enforced unidirectional physical security.
- **Split Ratios**: Configure optical power split ratios (e.g. 50/50, 70/30, 80/20) based on link distance and optical power budget calculations.

### B. Step-by-Step: Adding TAPs & Configuring Optical Links
Follow this workflow to deploy optical TAPs and configure transceivers for connected links:

1. **Place the TAP**: Ensure Advanced Mode is active. Expand the **Physical Hardware (SE) → TAPs** section in the left palette and drag the required TAP model (e.g. `TAP-M253`) onto the canvas.
2. **Cable to Appliance**: Drag an edge link from the TAP node to the receiving GigaVUE appliance (e.g. `GigaVUE-TA10` or `GigaVUE-HC2`).
3. **Open TAP Settings**: Click the TAP node on the canvas to open the right-hand **TAP Settings** panel.
4. **Specify Link Quantity**:
   - Locate the **Add link allocation** section.
   - Use the **Links** dropdown to select the number of physical tapped links (from `1` up to the module's maximum rated capacity, e.g. 2, 4, or 6 links).
   - **Chassis Cage Capacity Awareness**: The simulator dynamically inspects the connected TA/HC chassis. If the receiving chassis has fewer free cages than the requested allocation requires, the dropdown automatically caps the selectable links and displays an explanatory note (e.g. *"Limited by SFP cages free on GigaVUE-HC2"*).
5. **Select Tool Termination Optic**:
   - For passive TAPs, the network optic represents the passive internal splitter.
   - The **Tool Optic** dropdown is governed by the TAP termination matrix. It displays only compatible transceivers that the connected chassis can physically terminate (e.g. multimode LC transceivers for MM TAPs; singlemode LC for SM TAPs; BiDi transceivers for M506T; MPO breakouts for M501).
6. **Commit Allocation**: Click **+ Add Links**. The allocation is added to the **Active link allocations** list, updating the link counter (e.g. `2/2 links allocated`).
7. **Managing Active Allocations**: To adjust or delete an allocation, click the **✕** button on any entry in the Active Link Allocations list.

### C. The Critical Double-Optic Rule
> **CRITICAL HARDWARE RULE**: Every full-duplex tapped network link produces **two physical simplex optical outputs** (Northbound Tx/Rx and Southbound Tx/Rx).
> 
> Because network traffic is bidirectional, **two physical transceivers (optics)** are required on the receiving GigaVUE chassis (e.g. TA or HC appliance) for every single tapped link. The BOM engine and chassis front-panel visualizer automatically double the required optic count for all connected TAP links (e.g. 2 tapped links = 4 chassis optics; 4 tapped links = 8 chassis optics).

```
+---------------+                      +---------------------------------------+
|  Live Network |                      |         GigaVUE-HC / TA Node          |
|  Switch Link  |                      |                                       |
+-------+-------+                      |  +---------------------------------+  |
        | (Tapped)                     |  | Port 1/1/x1 (Northbound Ingest) |  |
+-------v-------+                      |  | Required: 1x SFP+/QSFP Optic    |  |
|  Optical TAP  | === Simplex Fiber A ===>|  +---------------------------------+  |
|  (Splitter)   |                      |                                       |
|               | === Simplex Fiber B ===>|  +---------------------------------+  |
+---------------+                      |  | Port 1/1/x2 (Southbound Ingest) |  |
                                       |  | Required: 1x SFP+/QSFP Optic    |  |
                                       |  +---------------------------------+  |
                                       +---------------------------------------+
```

### D. Synthetic Flow Generation (⚡ Generate Streams)
To immediately populate the topology with realistic traffic for demonstrations without manual stream setup:
- Click the **⚡ Generate Streams** button at the top of the **TAP Settings** panel.
- The simulator generates synthetic traffic streams calibrated to approximately 50% link utilisation across all allocated links, with profile characteristics adhering to the active project bias.

### E. Active TAPs (G-TAP A Series 2) & Breakout Panels
- **Active TAPs (`GTP-ATX21` & `GTP-ASF21`)**: For copper links (10/100/1000M) or fibre links requiring active signal regeneration.
  - Require power accessories: Redundant AC Power Supplies (`PBK-GTA21`), Battery Backup Modules (`BAT-GTA20` providing 3 hours of failover protection), and Regional AC Power Cords.
  - Network ports in a pair must share matching transceivers; tool ports must match network port speed.
- **Breakout Panels (`PNL-M341` & `PNL-M343`)**: Convert high-density MPO multi-fibre connectors into discrete duplex LC connections (e.g. breaking 1x 40G/100G QSFP port into 4x 10G/25G SFP channels).
  - A breakout panel consumes **1 slot** inside an `M100T` (3 slots total) or `M200T` (6 slots total) tray alongside optical TAPs, automatically factored into the tray bin-packing algorithm.

---

## 4. Traffic Aggregation (TA Series) & Inter-Chassis Fabric Interconnects

Building scalable, multi-tier visibility fabrics involves deploying Traffic Aggregators (TAs) at the edge or top-of-rack (ToR) and backhauling aggregated streams to core GigaVUE-HC visibility nodes.

### A. Understanding Traffic Aggregators (TAs) vs Core Nodes (HCs)
- **GigaVUE-TA Series (Traffic Aggregators)**: High-density 1RU and 2RU fixed or tiered aggregation appliances (`TA10`, `TA25`, `TA40`, `TA100`, `TA200`, `TA200E`, `TA400E`). Designed to ingest hundreds of TAP and SPAN feeds, filter traffic by L2–L4 header rules, and concentrate traffic into high-speed uplinks.
- **GigaVUE-HC Series (Core Visibility Nodes)**: Modular chassis (`HC1`, `HC1-Plus`, `HC2`, `HC3`) housing powerful GigaSMART compute engines for hardware-accelerated deduplication, packet slicing, SSL decryption, NetFlow generation, and complex flow mapping.

### B. Step-by-Step: Adding a TA & Linking to a GigaVUE-HC
Follow these steps to construct an aggregation-to-core hierarchy:

1. **Add the TA Node**: From the left palette, expand **Physical Hardware (SE) → TA Series** and drag the desired model onto the canvas (e.g. `GigaVUE-TA100` or `GigaVUE-TA25`).
2. **Add the HC Node**: Expand **Physical Hardware (SE) → HC Series** and drag a core chassis onto the canvas (e.g. `GigaVUE-HC3` or `GigaVUE-HC1-Plus`).
3. **Establish the Link**: Draw an edge link from the TA node to the HC node.
4. **Review Link Classification**: The simulator automatically identifies the link as an **Inter-Chassis Fabric Interconnect (`FABRIC TRUNK`)**.
5. **Configure Multi-Link Trunks & Optics**:
   - Click the connection link to open the **Link Detail Panel** in the right sidebar.
   - Under **Number of Links / Channels**, increase the count to represent a multi-link trunk bundle (e.g. 2× or 4× parallel uplinks).
   - In the **Source Optic (TA)** and **Target Optic (HC)** selectors, choose matching high-speed transceivers (e.g. `QSFP-533T` 100G LR4, `QSFP-543T` 100G SR4, or `SFP-532T` 25G SR).
6. **One-Click Transceiver Alignment**: If the endpoints have unassigned transceivers or mismatched speeds/media, click the **"Resolve Connection Problem"** button. The engine automatically assigns compatible, TAA-compliant transceiver pairs into the physical cages of both appliances.

### C. GigaStream Load Balancing Distribution
When multiple physical links interconnect appliances or feed tool farms, configure load distribution in the Link Detail Panel:
- **Round Robin**: Distributes ingress packets equally across all physical member links.
- **L4 Five-Tuple Hash**: Computes a hash of Source IP, Destination IP, Protocol, Source Port, and Destination Port, ensuring individual conversational flows remain pinned to a single link to prevent packet reordering at monitoring tools.

### D. Port Licensing Tiers & Automatic Over-Subscription Warnings
Certain TA models feature tiered software port licensing:
- **GigaVUE-TA25**: Available in **Quarter** (12× 10G/25G + 2× 40G/100G), **Half** (24× 10G/25G + 4× 40G/100G), or **Full** (48× 10G/25G + 8× 40G/100G) licensed port capacities.
- **GigaVUE-TA200**: Available in **Half** (32× 40G/100G) or **Full** (64× 40G/100G) licensed capacities.
- **GigaVUE-TA400E**: Available in **100G Software Port License**, **Upgrade License** (16× 100G + 16× 400G), or **Full** (32× 400G) capacities.
- **Automatic Diagnostics**: If configured optics exceed the active licence tier, the Hardware Node Panel displays a prominent alert (e.g. *"Configured optics exceed the licensed port count"*), accompanied by a one-click **"Upgrade License"** button that reconciles the BOM immediately.

---

## 5. GigaSMART on GigaVUE-HC Chassis (Advanced Mode Processing Pipeline)

In Advanced Mode, GigaSMART applications operate as an embedded, hardware-accelerated processing pipeline residing directly inside physical GigaVUE-HC chassis.

### A. Simple Mode vs Advanced Mode GigaSMART Mechanics
- **Simple Mode**: GigaSMART applications are dragged onto the canvas as independent rectangular functional blocks interposed between traffic maps and monitoring tools.
- **Advanced Mode**: GigaSMART applications are **internal engine features** embedded into the physical line cards and compute blades of a GigaVUE-HC chassis. They do not exist as separate floating nodes on the canvas.

### B. Chassis Module Slots & GigaSMART Blades (SMT)
Before running GigaSMART applications, ensure the chassis possesses GigaSMART compute hardware:
- **GigaVUE-HC1 & HC2**: Feature built-in GigaSMART engines on their base chassis.
- **GigaVUE-HC1-Plus**: Requires an `SMT-HC1P-GEN3` module populated into physical Slot 2 or Slot 3.
- **GigaVUE-HC3**: Requires an SMT blade populated into one of its 4 modular bays:
  1. Select the `GigaVUE-HC3` chassis on the canvas.
  2. In the right-hand **General** tab, locate the **Module Slots** panel.
  3. On an empty slot (e.g. Slot 2), select `SMT-HC3-C05` (GigaSMART Module with 5x 100G/40G QSFP28 cages).

### C. Step-by-Step: Adding GigaSMART Features to an HC Chassis
1. **Locate GigaSMART Apps**: In the left sidebar, expand the **Applications** accordion. You will find 15 GigaSMART apps:
   - *Application Metadata Intelligence (AMI)*, *Deduplication*, *Load Balancing (GigaStream)*, *Masking*, *Packet Slicing*, *Advanced Flow Slicing*, *SSL Decrypt*, *Header Stripping*, *IP FlowVUE*, *GTP Flow Filtering*, *GTP Whitelisting*, *GTP Flow Sampling*, and *Tunnel Decapsulation*.
2. **Drag and Drop Directly onto Chassis**: Click and drag the desired application from the Applications palette and **drop it directly on top of the GigaVUE-HC chassis node on the canvas**.
3. **Automated Validation**:
   - **Hardware Validation**: If the target chassis lacks the necessary SMT engine blade, the simulator flags: *"GigaSMART action is not supported on the currently installed modules in this chassis."*
   - **Engine Pass Validation**: If you attempt to combine apps that require separate physical engine passes on a chassis with only one compute engine, the system prevents the drop with a combination alert.
4. **Access the GigaSMART Pipeline Tab**: Once dropped, select the HC chassis. A dedicated **GigaSMART Apps** tab appears in the Hardware Node Panel tabs header.

### D. Pipeline Sequencing & Fine-Grained Feature Configuration
Open the **GigaSMART Apps** tab to configure the internal pipeline:

1. **Reorder Pipeline Stages**: The sequence of execution matters (e.g. performing SSL Decryption before Deduplication or Packet Slicing). Use the **▲ (Move Up)** and **▼ (Move Down)** buttons on any app card to adjust its execution order.
2. **Configure App Parameters**:
   - **Deduplication**: Adjust the **Estimated Deduplication Rate (%)** slider (0–100%) and select a drift profile (Stable, Realistic Fluctuations, Burst Spikes) to simulate dynamic drop performance.
   - **Packet Slicing**: Define the payload slice threshold (e.g. 64, 128, 256 bytes) to discard unnecessary payload data while preserving protocol headers.
   - **Header Stripping**: Select the target encapsulation protocol to remove before egress to tools (e.g. `VXLAN`, `VN-Tag`, `MPLS`, `GTP`).
   - **Application Metadata Intelligence (AMI)**: Select the output telemetry format (`CEF`, `JSON`, `NetFlow v9`, `IPFIX`) and configure metadata generation throughput rates.
   - **SSL Decrypt**: Configure key handling, cipher suite policies, and certificate validation options.
   - **Tunnel Decapsulation**: Select tunnel mode (`ERSPAN Decapsulation`, `VXLAN`, `L2GRE`, `IP Tunnel`), ERSPAN type (Type II / Type III), and termination tunnel ID/IP.
3. **Remove Stages**: Click the **✕** button on any app card to remove it from the chassis pipeline.

---

## 6. Canvas Management, Multi-Select & Demonstration Tools

To assist SEs during live customer demonstrations and while designing dense enterprise topologies:

### A. Focus Mode (Clean Demonstration Mode)
- **What it does**: Instantly hides the left element palette and the bottom traffic generator drawer, providing a clean, distraction-free canvas for presentations.
- **How to toggle**: Click the **Focus** button in the header bar or press the **`Esc`** key on your keyboard. Click **Exit Focus** or press **`Esc`** again to restore all sidebars.

### B. Multi-Select Batch Editing & Cluster Groups (TAPs & Tools)
Dense topologies with 20+ TAPs or tools can crowd the canvas:
1. **Multi-Selection**: Hold **`Shift`** and click multiple nodes, or drag a selection box across canvas elements.
2. **Floating Action Banner**: When two or more TAPs or Tools are selected, a floating grouping banner appears at the top centre of the canvas:
   - **Cluster TAPs / Cluster Tools**: Condenses all selected member nodes into a single, compact **Cluster Node**.
   - **Expand / Collapse**: Click to collapse the cluster into a compact footprint showing aggregated link counts and total throughput, or expand it to display individual member nodes.
   - **Dissolve Cluster**: Unclusters member nodes back into individual standalone canvas nodes.
3. **Batch Property Editing**: With multiple nodes selected, open the right-hand panel to apply batch modifications across all selected units simultaneously (e.g. assigning an entire group of nodes to a specific datacentre site).

---

## 7. Troubleshooting & The Bill of Materials (BOM) Indicator

The **BOM Status Indicator** in the top header bar continuously audits your topology for electrical, optical, optical speed, and licensing discrepancies.

### A. Reading the BOM Status Indicator
- **Green Checkmark (`BOM: Valid`)**: All connected hardware has compatible optics, valid power supplies, sufficient chassis cages, and required GigaSMART licences.
- **Amber / Red Warning Badge (`BOM: X Issues`)**: One or more hardware constraints are violated. Clicking the badge opens the diagnostic breakdown.

```
+-------------------------------------------------------------------------------+
|  Top Header Bar: [ ⚙ Settings ]  [ 🇦🇺 AU ]  [ ⚠ BOM: 3 Issues ]  [ 📄 Report ]  |
+-------------------------------------------------------------------------------+
```

### B. Diagnostic Checklist for Common BOM Issues

| Issue Category | Root Cause | How to Identify in UI | Step-by-Step Resolution |
| :--- | :--- | :--- | :--- |
| **Optic Speed Mismatch** | A link connects two mismatched transceivers (e.g. 10G SFP+ to 40G QSFP+). | Link line renders in orange/red; Link Detail Panel displays *"Speed mismatch: 10G vs 40G"*. | Click the link, open the **Link Detail Panel**, and click **"Resolve Connection Problem"**. The engine will automatically upgrade the lower-speed optic to match the higher-speed peer. |
| **Missing Transceiver** | A physical port is cabled on the canvas but has no optic assigned in its cage. | BOM shows *"Unpopulated Port Cage"*; chassis front-panel shows an empty cage on an active link. | In the **Link Detail Panel** or right-hand **Optics Chooser Panel**, click **Assign Optic** or click the auto-suggested compatible SKU. |
| **Fibre Media Conflict** | Singlemode TAP (1310nm) connected to Multimode Transceiver (850nm SR). | Link Detail Panel shows *"Media mismatch: SMF vs MMF"*. | Change the optic SKU from SR (e.g. `SFP-532`) to LR (e.g. `SFP-502` / `SFP-533`) in the Optics Chooser. |
| **Unassigned Sites** | One or more hardware appliances lack an explicit physical site assignment in a multi-site project. | Warning banner during BOM export: *"Devices found with unassigned sites"*. | Select the flagged node, open the Configuration Panel, and assign it to an existing site (e.g. *Primary DC*). |
| **Chassis Slot Over-Subscription** | More links are connected to a chassis than available physical cages on installed blades. | Chassis header flags *"Port Capacity Exceeded: 52/48 Ports"*. | Click the chassis, open the **Hardware Slots** panel, and insert an additional port module (e.g. `PRT-HC3-C08Q08` or `PRT-HC1-X24`). |
| **Missing GigaSMART Licences** | Advanced GigaSMART apps (e.g. FlowVUE, SSL, GTP) configured without required engine blades or licences. | BOM flags *"GigaSMART Engine Capacity Missing"*. | In the chassis inspector, add a GigaSMART blade (e.g. `SMT-HC3-C05` or `SMT-HC1P-GEN3`) or verify the licence mode. |
| **Power Cord Discrepancy** | AC chassis configured without regional power cords or missing redundant feeds. | Power Supply Panel flags *"Missing AC Power Cord"*. | In the **Power Supply Panel**, select the appropriate dual AC feed matching your active **Project Region**. |

---

## 8. Optics Management & Reallocation in the Side Panel

The right-hand **Optics Chooser & Transceiver Panel** allows fine-grained transceiver inventory management across every cage in your solution:

### A. Inspecting Transceiver Cages
1. Select any GigaVUE chassis or physical TAP node.
2. In the right-hand panel, select the **Optics / Transceivers** tab.
3. Every slot and physical cage is listed with its installed optic SKU, media speed, wavelength, and connected link state.
4. Active cages feature photographic badge overlays with tooltips showing connected destination nodes.

### B. Reallocating & Replacing Optics
- **Per-Cage Swapping**: Click any cage dropdown to swap transceivers (e.g. upgrading `SFP-502 10G LR` to `SFP-532T 25G SR` or `QSFP-533 100G LR4`). The system immediately recalculates power draw and BOM pricing.
- **Quantity Steppers & Bin Removal**: Use quantity stepper controls to increment or decrement installed transceiver counts directly, or click the bin removal icon to unseat transceivers.
- **Bulk Optic Replacement Tool**:
  - When standardising transceiver types across an entire datacentre, use the **Bulk Optic Replacement** tool located at the bottom of the Optics panel.
  - Select the target source SKU (e.g. all non-TAA `SFP-501`) and replace them with the desired destination SKU (e.g. TAA-compliant `SFP-501T`) across the entire canvas or within a selected chassis in a single click.
- **One-Click Link Auto-Resolve**:
  - Selecting any connection link presents a **"Resolve Connection Problem"** button that automatically reconciles speeds, media types, and TAA compliance preferences.
- **TAA-Compliant Optics Preference**:
  - Auto-assignment algorithms always prioritise Trade Agreements Act (TAA) compliant transceiver variants (`-T` suffix) if supported by the chassis hardware matrix.

---

## 9. Power Supplies, Regional Settings & Territories

Power architecture and regional compliance are managed globally and per-node:

### A. Territory / Regional Selector
Click the flag icon in the top-right header menu to switch between supported deployment territories:

| Territory / Region | Header Flag | Chassis AC Power Cord | G-TAP A Series 2 Power Cord (ATX-21 / ASF-21) | DC Power Cable Standard |
| :--- | :---: | :--- | :--- | :--- |
| **United States & NA** | 🇺🇸 | `PCD-00001` (125VAC NA Plug) | `PCD-00A21` (10A/125V NA Plug) | `PCD-00051` (D-SUB 10AWG) |
| **European Union** | 🇪🇺 | `PCD-00003` (250VAC EU Schuko) | `PCD-00A23` (2.5A/250V EU Plug) | `PCD-00051` (D-SUB 10AWG) |
| **United Kingdom** | 🇬🇧 | `PCD-00005` (250VAC UK BS 1363) | `PCD-00A25` (2.5A/250V UK Plug) | `PCD-00051` (D-SUB 10AWG) |
| **Australia & NZ (ANZ)** | 🇦🇺 | `PCD-00007` (AS/NZS 3112 AU Plug) | `PCD-00A27` (2.5A/250V AU Plug) | `PCD-00051` (ANZ Compliant DC) |

### B. Dual AC / DC Feeds
- **Dual Redundant AC**: Standard enterprise deployment allocating 2x power supply units and 2x regional power cords per chassis.
- **High-Voltage DC**: For telecom central offices and DC datacentres, assigns D-SUB or Positronic DC terminal cables (`PCD-00051` / `PCD-00061`) with certified electrician installation notices.

---

## 10. Professional Deliverables, Reports & Native File Choosers

Generate customer-ready technical documentation, commercial proposals, and export deliverables suites:

### A. The Signal Path & Architecture Report
Click the **Report** button in the top header bar to generate comprehensive multi-page documentation:
- **Format Consolidation**: Standalone Patch Sheet and Crossover formats are consolidated into the unified **Signal Path & Architecture** specification, delivering an end-to-end engineering package.
- **Content Included**:
  - **Cover Page**: Modern layout featuring project metadata, date, author, Gigamon brand lockup, and optional partner co-branding.
  - **Executive Summary & Key Metrics**: High-level problem statement, project scope, and traffic reduction savings.
  - **Topology Diagram**: High-resolution vector diagram of the canvas topology. In multi-site projects, the generator automatically detects complex layouts and produces dedicated per-site sub-diagrams for maximum clarity.
  - **Component Narrative**: Plain-English, step-by-step description explaining the operational journey of packets through the visibility architecture.
  - **Bill of Materials (BOM)**: Complete SKU list with descriptions, unit counts, multipack rollups, and pricing breakdowns.
  - **Physical Rack & Deployment (Appendix B)**: 42U rack elevations, rack unit counts, weights, power consumption (Watts), and thermal output (BTU/hr).

### B. Custom Markdown Executive Summary & Dynamic Token Chips
Customise the report's executive summary directly within the Report dialog:
1. **Markdown Support**: Enter standard Markdown formatting including `**bold text**`, `*italics*`, `### headings`, and `- bullet lists`.
2. **Dynamic Token Chips**: Click any token chip above the textarea to insert runtime variables that resolve dynamically during PDF generation:
   - `{{projectName}}`: Active project scenario name.
   - `{{partnerName}}`: Configured partner company name.
   - `{{siteCount}}`: Number of physical datacentre sites.
   - `{{totalLinks}}`: Count of physical and logical connections.
   - `{{hardwareCount}}`: Total count of physical chassis, TAPs, and appliances.
   - `{{licenseModel}}`: Active licensing model (Perpetual or Subscription).
   - `{{date}}`: Current generation date.

### C. Glean AI Executive Summary Assistant Workflow
For Gigamon SEs and certified partners utilizing Glean AI:
1. **Generate Prompt**: In the Report modal, click the **"📋 Copy Glean Prompt"** button (or **"📄 Export Prompt (.md)"**).
2. **Automatic Context Gathering**: The generator compiles complete architectural context, node counts, site distributions, installed GigaSMART apps, traffic reduction metrics, and strict licensing rules into a copy-and-paste prompt.
3. **Execute in Glean**: Paste the prompt into Glean AI. Glean produces a polished, executive-ready Markdown summary tailored to C-level stakeholders.
4. **Paste into Report**: Copy Glean's Markdown response directly into the **Executive Summary / Notes** textarea in the Report dialog.

```
+-----------------------------------------------------------------------------------------+
|                                  Glean AI Workflow                                      |
|                                                                                         |
|  [ 📋 Copy Glean Prompt ] === Paste ===> [ Glean AI Chat ] === Copy Markdown Output ==> |
|                                                                                         |
|  ===> [ Paste into Executive Summary Box ] ===> [ Generate Customer-Ready PDF Report ] |
+-----------------------------------------------------------------------------------------+
```

### D. Report Templates & Partner Co-Branding
- **Partner Co-Branding**:
  - Select **Co-Branded with Partner** under Branding.
  - Enter the **Partner Company Name** and click **Upload Logo** to select the partner's PNG/SVG logo.
  - The partner logo is positioned cleanly alongside the official Gigamon badge on the cover page.
- **Section Toggles**: Selectively enable or disable specific report chapters (Executive Summary, Topology Diagram, Component Narrative, Bill of Materials, Rack Elevation).
- **Template Management**: Click **Save As New** to save your customised branding, markdown text, and section choices as a reusable template. Export templates as `.json` files to share with team members or import them on another machine.

### E. Native File System Choosers ("Save As" & "Dump All to Folder...")
The simulator integrates directly with the modern **File System Access API**:
- **Immediate Save As Dialog**: Clicking **Generate Report** or screenshot export opens your operating system's native file picker immediately, allowing you to choose the exact destination directory and filename.
- **Post-Save Confirmation**: Once written to disk, a confirmation modal confirms the exact saved filename.
- **"Dump All to Folder..." Deliverables Bundle**:
  - Available in both the Report dialog and under the **Project** menu.
  - Opens a native directory picker to select an existing or newly created project directory.
  - Streams the entire project deliverables suite directly into that directory in a single operation:
    1. `Signal_Path_Architecture_Report_<Project>.pdf`
    2. `Bill_of_Materials_<Project>.csv`
    3. `Topology_Diagram_<Project>.png`
    4. `Project_Scenario_<Project>.gvp` (or `.json`)
    5. Commercial Quote breakdown (where applicable)

### F. Offline Standalone Application Download (`.html`)
For partner SEs operating in secure, air-gapped customer environments or conducting demonstrations without reliable internet connectivity:
- In the top header bar, click the **Project** dropdown menu.
- Select **📥 Download Offline App (.html)...**.
- The simulator generates and downloads a single, self-contained, offline-ready HTML application file. This standalone file contains all application logic, styling, hardware photography, and SKU catalogues, and runs natively in any modern web browser without an internet connection or external web server.

### G. Browser Local Storage vs File Exports
The simulator provides two complementary persistence mechanisms:
1. **Browser Storage (Local Slots)**:
   - **Where stored**: HTML5 `localStorage` in the user's local web browser (`fm-simulator-slot-<Name>`).
   - **Use case**: Quick, friction-free checkpointing during an active design session without creating or managing disk files.
   - **Persistence characteristics**: Instant saving and loading on the same PC and browser. Does not transfer across machines or private/incognito sessions, and will be cleared if browser website data or cookies are purged.
2. **GigaVUE Project (`.gvp`) & Deliverables Packages**:
   - **Where stored**: Physical disk files on local drives, network shares, OneDrive, or Google Drive via native File System pickers or directory dumps.
   - **Use case**: Permanent storage, formal archival, emailing or version-controlling project blueprints, and sharing designs across team members.
   - **Included data**: Complete topological node graph, links, allocated transceivers, custom rule configurations, and commercial quote workspaces.

---

## 11. 42U Rack Elevation View & TAP Tray Bin-Packing

Switch between **Canvas View** and **Rack View** using the view toggle on the canvas:

1. **Photographic Racking**: Racked appliances display real chassis photography with installed blades composited into their physical slots at exact RU heights (1RU to 14RU).
2. **Automated TAP Tray Bin-Packing**: TAP-M100T (3-bay) and TAP-M200T (6-bay) trays generate automatically based on physical tap module and breakout panel counts.
3. **Interactive Rack Management**: Drag unracked hardware from the site sidebar into empty rack positions, or click **✕** to safely return units to the unracked staging pool.
4. **Site-Specific Racks**: View and organise distinct 42U racks for each physical datacentre site defined in your solution.
