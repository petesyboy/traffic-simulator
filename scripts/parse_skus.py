import os
import json
import csv
import sys

# Define paths
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SKU_JSON_PATH = os.path.join(ROOT_DIR, 'src', 'constants', 'skus.json')
METADATA_JSON_PATH = os.path.join(ROOT_DIR, 'src', 'constants', 'skus_metadata.json')

def main():
    if len(sys.argv) < 2:
        print("Usage: python scripts/parse_skus.py <path_to_price_list_csv>")
        print("Example: npm run update-skus -- scripts/price_list.csv")
        sys.exit(1)

    csv_path = sys.argv[1]
    if not os.path.exists(csv_path):
        print(f"Error: CSV file not found at {csv_path}")
        sys.exit(1)

    # Load existing SKUs and metadata
    try:
        with open(SKU_JSON_PATH, 'r', encoding='utf-8') as f:
            skus = json.load(f)
    except Exception:
        skus = {}

    try:
        with open(METADATA_JSON_PATH, 'r', encoding='utf-8') as f:
            metadata = json.load(f)
    except Exception:
        metadata = {}

    print(f"Loaded {len(skus)} existing SKUs.")

    added = 0
    updated = 0
    no_change = 0

    # Read CSV
    with open(csv_path, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        
        # Determine columns
        headers = reader.fieldnames
        sku_col = None
        desc_col = None
        eos_col = None
        eol_col = None
        repl_col = None
        
        for h in headers:
            h_lower = h.lower().strip()
            if h_lower == 'sku':
                sku_col = h
            elif h_lower == 'sku for' and not sku_col:
                sku_col = h
            elif 'sku' in h_lower and not sku_col:
                sku_col = h
                
            if h_lower == 'detailed description':
                desc_col = h
            elif h_lower == 'description' and not desc_col:
                desc_col = h
            elif 'desc' in h_lower and not desc_col:
                desc_col = h
                
            if 'end of sale' in h_lower or 'eos' in h_lower:
                if 'replacement' in h_lower:
                    repl_col = h
                else:
                    eos_col = h
            elif 'end of life' in h_lower or 'eol' in h_lower:
                eol_col = h
            elif 'replacement' in h_lower and not repl_col:
                repl_col = h
                
        if not sku_col or not desc_col:
            print("Error: Could not identify SKU or Description columns in CSV.")
            print(f"CSV Headers found: {headers}")
            sys.exit(1)
            
        print(f"Parsing CSV: SKU='{sku_col}', Description='{desc_col}'")
        if eos_col: print(f"  Found End of Sale column: '{eos_col}'")
        if eol_col: print(f"  Found End of Life column: '{eol_col}'")
        if repl_col: print(f"  Found Replacement SKU column: '{repl_col}'")

        for row in reader:
            sku = row[sku_col].strip().upper()
            desc = row[desc_col].strip()
            if not sku:
                continue
                
            eos_val = row.get(eos_col, '').strip() if eos_col else ''
            eol_val = row.get(eol_col, '').strip() if eol_col else ''
            repl_val = row.get(repl_col, '').strip().upper() if repl_col else ''
            
            # Auto-suffix EOS date to description if present
            if eos_val and eos_val.lower() not in desc.lower():
                desc += f" (EOS {eos_val})"
            
            # Save SKU description
            if sku in skus:
                if skus[sku] != desc:
                    skus[sku] = desc
                    updated += 1
                else:
                    no_change += 1
            else:
                skus[sku] = desc
                added += 1
                
            # Save SKU metadata if any metadata exists
            if eos_val or eol_val or repl_val:
                metadata[sku] = {
                    "eos": eos_val,
                    "eol": eol_val,
                    "replacement": repl_val
                }

    # Save files
    try:
        with open(SKU_JSON_PATH, 'w', encoding='utf-8') as f:
            json.dump(skus, f, indent=2, ensure_ascii=False)
        with open(METADATA_JSON_PATH, 'w', encoding='utf-8') as f:
            json.dump(metadata, f, indent=2, ensure_ascii=False)
            
        print("\n--- Update Summary ---")
        print(f"New SKUs Added:      {added}")
        print(f"SKUs Updated:        {updated}")
        print(f"SKUs Unchanged:      {no_change}")
        print(f"Total SKUs:          {len(skus)}")
        print(f"Metadata entries:    {len(metadata)}")
        print(f"Saved to: {SKU_JSON_PATH} and {METADATA_JSON_PATH}")
    except Exception as e:
        print(f"Error saving files: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()
