import os
import json
import csv
import sys

# Define paths
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SKU_JSON_PATH = os.path.join(ROOT_DIR, 'src', 'constants', 'skus.json')

def main():
    if len(sys.argv) < 2:
        print("Usage: python scripts/parse_skus.py <path_to_price_list_csv>")
        print("Example: npm run update-skus -- scripts/price_list.csv")
        sys.exit(1)

    csv_path = sys.argv[1]
    if not os.path.exists(csv_path):
        print(f"Error: CSV file not found at {csv_path}")
        sys.exit(1)

    # Load existing SKUs
    try:
        with open(SKU_JSON_PATH, 'r', encoding='utf-8') as f:
            skus = json.load(f)
    except Exception as e:
        print(f"Error loading {SKU_JSON_PATH}: {e}")
        skus = {}

    print(f"Loaded {len(skus)} existing SKUs.")

    added = 0
    updated = 0
    no_change = 0

    # Read CSV
    # Supported header names:
    # SKU / Part Number / PartNumber
    # Description / Desc / Name
    with open(csv_path, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        
        # Determine columns
        headers = reader.fieldnames
        sku_col = None
        desc_col = None
        
        for h in headers:
            h_lower = h.lower().strip()
            if 'sku' in h_lower or 'part number' in h_lower or 'partnumber' in h_lower:
                sku_col = h
            elif 'description' in h_lower or 'desc' in h_lower or 'name' in h_lower:
                desc_col = h
                
        if not sku_col or not desc_col:
            print("Error: Could not identify SKU or Description columns in CSV.")
            print(f"CSV Headers found: {headers}")
            print("Please ensure your CSV has header columns containing 'SKU' and 'Description'.")
            sys.exit(1)
            
        print(f"Parsing CSV using columns: SKU='{sku_col}', Description='{desc_col}'...")

        for row in reader:
            sku = row[sku_col].strip()
            desc = row[desc_col].strip()
            if not sku:
                continue
                
            # Clean SKU (uppercase, trim)
            sku = sku.upper()
            
            # Check for EOS flags or dates in other columns
            eos_info = ""
            for k, v in row.items():
                if k != sku_col and k != desc_col and v:
                    k_lower = k.lower()
                    if 'eos' in k_lower or 'end of sale' in k_lower:
                        eos_info = f" (EOS {v.strip()})"
            
            # If EOS is mentioned in the description, ensure it is highlighted
            if eos_info and eos_info.lower() not in desc.lower():
                desc += eos_info

            if sku in skus:
                if skus[sku] != desc:
                    skus[sku] = desc
                    updated += 1
                else:
                    no_change += 1
            else:
                skus[sku] = desc
                added += 1

    # Save back to json
    try:
        with open(SKU_JSON_PATH, 'w', encoding='utf-8') as f:
            json.dump(skus, f, indent=2, ensure_ascii=False)
        print("\n--- Update Summary ---")
        print(f"New SKUs Added:      {added}")
        print(f"SKUs Updated:        {updated}")
        print(f"SKUs Unchanged:      {no_change}")
        print(f"Total SKUs in List:  {len(skus)}")
        print(f"Successfully saved to: {SKU_JSON_PATH}")
    except Exception as e:
        print(f"Error saving updated SKUs: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()
