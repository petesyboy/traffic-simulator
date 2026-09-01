# Gigamon Flow Map Simulator — Systems Engineer (SE) Reference Guide

Welcome to the Systems Engineer (SE) reference guide for the **Gigamon Fabric Manager & Flow Map Simulator**. This documentation covers both **Simple Mode** (logical traffic flow mapping) and **Advanced Mode** (physical hardware topology design), including traffic source configuration, physical optical TAP architecture, link bundling, Bill of Materials (BOM) diagnostic resolution, and transceiver reallocation engines.

---

## 1. System Architectures & Visualisation Modes

The simulator supports two primary runtime operational modes, toggleable via the top navigation bar:

### A. Simple Mode (Logical Flow Map)
Designed for high-level architectural presentations and logical traffic reduction simulations:
- **Logical Ingress Nodes**: SPAN ports and abstract TAP feeds.
- **Traffic Maps & Filters**: Route and filter traffic streams matching VLANs, IP versions (IPv4/IPv6), CIDR subnets, and L4 transport protocols/ports (TCP/UDP/ICMP).
- **GigaSMART Engine Nodes**: Visualise inline and out-of-band traffic optimisation apps including Deduplication (with live drop-rate drift animations), Packet Slicing, Header Stripping, GTP Correlation, SSL/TLS Decryption, and Application Metadata Intelligence (AMI).
- **Target Tools**: Security and compliance monitoring tools categorised as Packet-consuming (Wireshark, Zeek, Suricata), Metadata-consuming (Splunk, Elastic, QRadar), or Storage-oriented (S3, PCAP Storage).

### B. Advanced Mode (Physical Hardware Design)
Transitions the canvas into a high-fidelity physical engineering environment:
- **Photographic Front-Panel Views**: GigaVUE-HC1, HC1-Plus, HC2, HC3, and HCT chassis render true-to-scale front-panel photography with installed line cards, GigaSMART blades, and bypass modules composited into their exact physical slot positions.
- **Front-Panel Optic Occupancy Badges**: Active optical transceivers overlay directly onto front-panel photography with colour-blind accessible badges indicating occupied cages.
- **Real-Time Interface Throughput**: Displays live ingress and egress metrics directly on hardware nodes (`In: X.X Gbps` / `Out: X.X Gbps`).
- **Input Node Aggregation**: TAPs and input feeds on the left margin calculate total aggregated ingress throughput.
- **Hardware Inspector Panel**: Click the 📋 icon in a chassis header to open a full-size hardware summary featuring slot legends, port states, installed blades, and power supply configurations.
- **Tidy Layout Engine**: Click the **Tidy Layout** button on the canvas toolbar to instantly auto-align complex multi-tier topologies into clean architectural columns (Sources → TAPs/Aggregation → Maps/GigaSMART → Target Tools).
- **Multi-Site Architecture**: Organise nodes into distinct physical datacentres (e.g. *Primary DC*, *Secondary DC*, *Branch Office*) for site-scoped BOMs and rack elevations.

### C. Unlocking Advanced Mode (4-Click Logo Toggle)
- **4-Click Logo Toggle**: Click the **Gigamon logo** in the top-left corner of the header **four times in rapid succession** to toggle between **Standard View** and **Expert Designer** (Advanced Mode).
- **Unlocked Capabilities in Advanced Mode**:
  - **BOM Tab & Diagnostics**: Access the real-time physical inventory, exact SKU resolution, multipack rollups, and pricing breakdowns.
  - **Physical Hardware Library**: Expands the component palette to include physical **Traffic Aggregators (TAs)**, **Optical TAPs**, **Breakout Panels**, and **GigaVUE-HC Series Chassis**.
  - **Hardware & Transceiver Side Panels**: Configure chassis module slots, transceiver cages, licence capacity, and redundant power supplies.

---

## 2. Ingress Traffic & Source Modelling

Accurately simulating network traffic volume and characteristics is fundamental to sizing Gigamon visibility fabrics.

### A. Creating & Configuring Traffic Sources
Traffic enters the visibility fabric via **Traffic Source** nodes or **Optical TAP** links:
1. **Adding Sources**: Drag a **Traffic Source / SPAN** or **Optical TAP** node from the left palette onto the canvas.
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

## 3. Optical TAPs & Breakout Infrastructure

Gigamon optical TAPs provide non-intrusive, 100% passive, zero-packet-loss access to physical network links.

### A. Modular Optical TAPs (M100T & M200T Trays)
- **High-Density Passive Modules**: Modular TAPs sit inside rack-mounted trays:
  - **M100T Tray**: 1RU tray supporting up to **3 TAP modules**.
  - **M200T Tray**: 1RU high-density tray supporting up to **6 TAP modules**.
- **Common TAP Modules**:
  - `TAP-M251`: 1G/10G Singlemode Fiber TAP (1310/1550nm, LC connectors).
  - `TAP-M253`: 1G/10G Multimode 50µm OM3/OM4 Fiber TAP (850nm, LC connectors).
  - `TAP-M501`: 40G/100G Singlemode Fiber TAP (MPO/LC).
  - `TAP-M506T`: 40G/100G Multimode BiDirectional (BiDi) Fiber TAP (specifically designed for Cisco/Arista BiDi infrastructure).
- **Split Ratios**: Configure optical power split ratios (e.g. 50/50, 70/30, 80/20) based on link distance and optical power budget calculations.

### B. The Critical Double-Optic Rule
> **CRITICAL HARDWARE RULE**: Every full-duplex tapped network link produces **two physical simplex optical outputs** (Northbound Tx/Rx and Southbound Tx/Rx).
> 
> Because network traffic is bidirectional, **two physical transceivers (optics)** are required on the receiving GigaVUE chassis (e.g. TA or HC appliance) for every single tapped link. The BOM engine automatically doubles the required optic count for all connected TAP links.

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

### C. Active TAPs (G-TAP A Series 2)
For copper links or environments requiring signal regeneration:
- **Models**: `GTP-ATX21` (10/100/1000M Copper TAP) and `GTP-ASF21` (1G/10G Fiber Active TAP).
- **Power & Redundancy Accessories**:
  - Redundant AC Power Supplies (`PBK-GTA21`).
  - Battery Backup Modules (`BAT-GTA20` provides up to 3 hours of failover protection during total power outage).
  - Regional AC Power Cords (`PCD-00A21` US, `PCD-00A23` EU, `PCD-00A25` UK, `PCD-00A27` AU).

### D. Breakout Panels (`PNL-M341` & `PNL-M343`)
- **MPO-to-LC Fan-Out**: Breakout panels convert high-density MPO multi-fiber connectors into discrete duplex LC connections (e.g. breaking 1x 40G/100G QSFP port into 4x 10G/25G SFP channels).
- **Tray Slot Allocation**: A breakout panel consumes **1 slot** inside an `M100T` (3 slots total) or `M200T` (6 slots total) tray alongside optical TAPs, automatically factored into the tray bin-packing algorithm.

---

## 4. Link Configuration, Multi-Link Trunks & GigaStreams

Connecting appliances, assigning trunk links, and selecting optics follows a coordinated resolution workflow:

### A. Configuring Link Count (Multi-Link Trunks & GigaStreams)
When connecting a GigaVUE node to another appliance or a cluster of target tools:
1. Select the connection link on the canvas to open the **Link Detail Panel**.
2. Locate the **Number of Links / Channels** field.
3. Increase the link count (e.g. from `1` to `4` or `8` parallel links) to represent a multi-link trunk or GigaStream bundle.

### B. What Happens When Configuring Links & Assigning Optics
The simulator enforces strict hardware synchronization across link bundles:

1. **Automatic Optic Quantity Multiplier**:
   - Assigning a transceiver (e.g. `SFP-532T 25G SR`) to an endpoint on a 4-link trunk automatically updates the chassis inventory to require **4 transceivers**.
   - If the link originates from an **Optical TAP**, the Double-Optic Rule applies: a 4-link tapped trunk automatically requires **8 transceivers** on the receiving chassis.
2. **Adding Links AFTER Choosing Optics**:
   - If you select an optic (e.g. `SFP-502 10G LR`) on a 1-link connection and subsequently increase the link count to `4`, the newly added parallel links **automatically inherit the configured optic SKU and media parameters**.
   - The BOM engine and chassis front-panel visualizer immediately allocate 3 additional cages with matching transceivers.
3. **Changing Optics on an Existing Trunk**:
   - Selecting a new transceiver SKU in the Link Detail Panel updates all member links across the bundle simultaneously, preventing mismatched lanes within a single trunk.
4. **GigaStream Load Balancing Distribution**:
   - **Round Robin**: Divides ingress packets equally across all physical member links.
   - **L4 Five-Tuple Hash**: Computes an MD5/CRC hash of Source IP, Destination IP, Protocol, Source Port, and Destination Port, steering individual flows down a single link to prevent out-of-order packet delivery at the receiving tools.

---

## 5. Troubleshooting & The Bill of Materials (BOM) Indicator

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
| **Fiber Media Conflict** | Singlemode TAP (1310nm) connected to Multimode Transceiver (850nm SR). | Link Detail Panel shows *"Media mismatch: SMF vs MMF"*. | Change the optic SKU from SR (e.g. `SFP-532`) to LR (e.g. `SFP-502` / `SFP-533`) in the Optics Chooser. |
| **Unassigned Sites** | One or more hardware appliances lack an explicit physical site assignment in a multi-site project. | Warning banner during BOM export: *"Devices found with unassigned sites"*. | Select the flagged node, open the Configuration Panel, and assign it to an existing site (e.g. *Primary DC*). |
| **Chassis Slot Over-Subscription** | More links are connected to a chassis than available physical cages on installed blades. | Chassis header flags *"Port Capacity Exceeded: 52/48 Ports"*. | Click the chassis, open the **Hardware Slots** panel, and insert an additional port module (e.g. `PRT-HC3-C08Q08` or `PRT-HC1-X24`). |
| **Missing GigaSMART Licences** | Advanced GigaSMART apps (e.g. FlowVUE, SSL, GTP) configured without required engine blades or licences. | BOM flags *"GigaSMART Engine Capacity Missing"*. | In the chassis inspector, add a GigaSMART blade (e.g. `SMT-HC3-C05` or `SMT-HC1P-GEN3`) or verify the licence mode. |
| **Power Cord Discrepancy** | AC chassis configured without regional power cords or missing redundant feeds. | Power Supply Panel flags *"Missing AC Power Cord"*. | In the **Power Supply Panel**, select the appropriate dual AC feed matching your active **Project Region**. |

---

## 6. Optics Management & Reallocation in the Side Panel

The right-hand **Optics Chooser & Transceiver Panel** allows fine-grained transceiver inventory management across every cage in your solution:

### A. Inspecting Transceiver Cages
1. Select any GigaVUE chassis or physical TAP node.
2. In the right-hand panel, select the **Optics / Transceivers** tab.
3. Every slot and physical cage is listed with its installed optic SKU, media speed, wavelength, and connected link state.
4. Active cages feature photographic badge overlays with tooltips showing connected destination nodes.

### B. Reallocating & Replacing Optics
- **Per-Cage Swapping**: Click any cage dropdown to swap transceivers (e.g. upgrading `SFP-502 10G LR` to `SFP-532T 25G SR` or `QSFP-533 100G LR4`). The system immediately recalculates power draw and BOM pricing.
- **Bulk Optic Replacement Tool**:
  - When standardising transceiver types across an entire datacentre, use the **Bulk Optic Replacement** tool located at the bottom of the Optics panel.
  - Select the target source SKU (e.g. all non-TAA `SFP-501`) and replace them with the desired destination SKU (e.g. TAA-compliant `SFP-501T`) across the entire canvas or within a selected chassis in a single click.
- **One-Click Link Auto-Resolve**:
  - Selecting any connection link presents a **"Resolve Connection Problem"** button that automatically reconciles speeds, media types, and TAA compliance preferences.
- **TAA-Compliant Optics Preference**:
  - Auto-assignment algorithms always prioritise Trade Agreements Act (TAA) compliant transceiver variants (`-T` suffix) if supported by the chassis hardware matrix.

---

## 7. Power Supplies, Regional Settings & Territories

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

## 8. Professional Deliverables, Reports & Native File Choosers

Generate client-ready documentation and export solution deliverables:

### A. PDF Solution Reports
Click the **Report** button in the header to generate multi-page architectural documentation:
1. **Report Types**:
   - **Architecture & Design Report**: Complete executive summary, high-resolution topology diagrams, photographic chassis front panels, GigaSMART reduction analytics, and physical deployment tables.
   - **Patch Sheet & Wiring Schedule**: Comprehensive physical cabling guide for datacentre technicians detailing source node, source port, media type, cable length, destination node, and destination port.
   - **Crossover & Flow Table Report**: Mathematical flow mapping showing ingress VLAN/IP rules and egress tool delivery.
2. **Physical Environmental Specifications (Appendix B)**:
   - Aggregated and per-site breakdowns of total Rack Units (RU), dimensions (H × W × D in mm/inches), unit weights (kg/lbs), typical/max power consumption (Watts), heat dissipation (BTU/hr), and airflow directions.

### B. Native File System Choosers (Folder & File Streaming)
The simulator integrates directly with the **File System Access API**:
- **Immediate Save As Picker**: Clicking export buttons (PDF Report, Formal Quote, PNG Diagram) invokes the native OS file picker immediately upon click, allowing you to choose your exact target folder and filename without dumping files into the browser's `Downloads` folder.
- **"Dump All to Folder..." Deliverables Bundle**: Opens a native OS directory picker to select a dedicated project folder. The system generates and streams the core deliverables (PDF Reports, CSV BOMs, Topology JSON, and PNG Diagram) directly into the directory in a single operation.

---

## 9. 42U Rack Elevation View

Switch between **Canvas View** and **Rack View** using the view toggle on the canvas:

1. **Photographic Racking**: Racked appliances display real chassis photography with installed blades composited into their physical slots at exact RU heights (1RU to 14RU).
2. **Automated TAP Tray Bin-Packing**: TAP-M100T (3-bay) and TAP-M200T (6-bay) trays generate automatically based on physical tap module and breakout panel counts.
3. **Interactive Rack Management**: Drag unracked hardware from the site sidebar into empty rack positions, or click **✕** to safely return units to the unracked staging pool.
4. **Site-Specific Racks**: View and organise distinct 42U racks for each physical datacentre site defined in your solution.

