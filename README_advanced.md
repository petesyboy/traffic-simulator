# Gigamon Flow Map Simulator — Systems Engineer (SE) Reference Guide

Welcome to the SE edition of the **Gigamon Fabric Manager & Flow Map Simulator** documentation. This reference guide outlines both Simple Mode and Advanced Mode (Physical Hardware configurations) including the technical logic, validation constraints, and Bill of Materials (BOM) engine behaviors.

---

## 1. System Architectures & Modes

The simulator supports two runtime visualization modes, toggleable via the header menu:

### A. Simple Mode (Logical Flow Map)
Designed for high-level logical path mapping. Nodes represent logical objects:
- **SPAN Port / TAP Device**: Abstract traffic sources.
- **Traffic Maps & Filters**: Route and select traffic streams matching VLAN, IP version, IP subnets, or port values.
- **GigaSMART Engines**: Deduplication, slicing, stripping, etc. (Includes duplicate drop rate drift animations).
- **Target Tools**: Security/compliance tools categorized as Packet-consuming, Metadata-consuming, or Storage-oriented.

### B. Advanced Mode (Physical Hardware Design)
Transitions the canvas to a physical hardware configuration layout. Users place actual chassis models, physical TAP modules, configure power supplies, and view real-time interface metrics:
- **Real-time Metrics**: Displays live throughput parameters directly on physical hardware nodes (`In: X.X Gbps` / `Out: X.X Gbps`).
- **Input Node Aggregation**: TAPs and input nodes on the far-left summarize total ingress bandwidth.
- **BOM Engine**: Generates a physical inventory, matching optics, licenses, and cables automatically.

---

## 2. BOM Engine & Licensing Logic

The Bill of Materials (BOM) is dynamically generated under the **BOM** tab based on canvas configuration and connection paths:

1. **Licensing Modes**:
   - **Perpetual**: Lists hardware chassis, ports, base software, and perpetual licenses.
   - **HTL (Hybrid Trial/Term License)**: Incorporates term duration multipliers (e.g., 36 months) for term-based GigaSMART and core licenses.
2. **SKU Matching**:
   - Matches GigaSMART software licenses (e.g. `SMT-HC1P-GEN3-DD1-SW-TM` for GigaVUE-HC1 Plus) and maps them explicitly as **licences** (not "modules") in the BOM.
   - Automatically appends upgrading SKU suffixes for chassis capacity configurations (e.g., TA400 capacity license upgrades).
3. **Double Optic Rule**:
   - Because network traffic is northbound and southbound, every connected link requires two optics (e.g., SFP/QSFP) on the chassis side. The BOM engine automatically doubles the optic quantity for connected ports.

---

## 3. Optical Auto-Suggestions & Validation

To ensure proper hardware connectivity, the simulator performs real-time interface validation:

1. **TAP Fiber Mode Validation**:
   - Checks that the connected interface fiber matches (Singlemode vs. Multimode). Flags a mismatch warning if there is a conflict.
2. **Auto-Suggest Matrix**:
   - Connected TAPs automatically select appropriate transceivers (`SFP-532` for multimode, `SFP-533` for singlemode).
   - TA25E links to HC1 Plus suggest `Q28-502T` (100G QSFP28).
3. **Forced TAP-M506T Constraint**:
   - Connecting a **TAP-M506T** module to a GigaVUE chassis automatically suggests and locks the target optic to **`QSB-523T (40/100G QSFP28 Dual-Rate BiDi)`**.
   - Manual override is disabled in the configuration panel for this model to enforce termination rules.

---

## 4. Power Supply & Regional Settings

When a physical chassis is selected, configure power supply settings:

1. **AC Power**:
   - Automatically suggests power cords matching the configured **Project Region** (US, EU, UK).
2. **DC Power**:
   - Suggests DC wiring terminals instead of regional wall cords.
   - Displays a warning reminder if DC configuration is selected: *"DC wiring must be terminated by a certified electrician."*

---

## 5. Advanced Routing & Storage Filtering

1. **GigaStream Load Balancing**:
   - Configure GigaStream link counts with mismatch warning badges if the physical link count diverges.
   - Routes streams dynamically: **Round Robin** splits bandwidth evenly, while **L4 Hash** hashes the five-tuple header (IPs, ports, protocol) to route the full stream down a single selected link.
2. **Storage Tool Suppression (AMI / Metadata)**:
   - When a GigaSMART app is active and generating metadata (e.g. Application Metadata / AMI) on a chassis connected to S3 Object Storage, the simulator suppresses the raw packet stream to the storage tool.
   - The S3 Object Storage tool only receives the metadata stream (e.g. 5% of the total throughput), preventing link flooding.

---

## 6. Presentation Focus Mode
Double-clicking any node on the canvas highlights it with a bright, pulsing orange halo (`.node-presentation-glow`). This allows presenters to draw focus to specific layout entities during meetings. Double-clicking again or clicking the background canvas clears the glow.
