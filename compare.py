from sqlalchemy import MetaData
import sys
import importlib.util

def load_models(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module

models_old = load_models("models_old", "backend/app/models_old.py")
metadata_old = models_old.Base.metadata

models_curr = load_models("models_current", "backend/app/models.py")
metadata_curr = models_curr.Base.metadata

for table_name in metadata_curr.tables:
    t_curr = metadata_curr.tables[table_name]
    t_old = metadata_old.tables.get(table_name)
    if t_old is None:
        print(f"Table {table_name} missing in Supabase.")
        continue
    
    curr_cols = {c.name: c for c in t_curr.columns}
    old_cols = {c.name: c for c in t_old.columns}
    
    print(f"--- Table: {table_name} ---")
    print(f"1. Expected columns from models.py: {list(curr_cols.keys())}")
    print(f"2. Existing columns in Supabase: {list(old_cols.keys())}")
    
    missing = set(curr_cols.keys()) - set(old_cols.keys())
    extra = set(old_cols.keys()) - set(curr_cols.keys())
    
    print(f"3. Missing columns: {list(missing) if missing else 'None'}")
    print(f"4. Extra columns: {list(extra) if extra else 'None'}")
    
    type_diffs = []
    null_diffs = []
    fk_diffs = []
    
    for c_name in set(curr_cols.keys()) & set(old_cols.keys()):
        c1 = curr_cols[c_name]
        c2 = old_cols[c_name]
        if type(c1.type) != type(c2.type):
            type_diffs.append(f"{c_name}: {c1.type} vs {c2.type}")
        if c1.nullable != c2.nullable:
            null_diffs.append(f"{c_name}: {c1.nullable} vs {c2.nullable}")
        
        # compare FKs
        fk1 = set(fk.target_fullname for fk in c1.foreign_keys)
        fk2 = set(fk.target_fullname for fk in c2.foreign_keys)
        if fk1 != fk2:
            fk_diffs.append(f"{c_name}: {fk1} vs {fk2}")

    print(f"5. Type differences: {type_diffs if type_diffs else 'None'}")
    print(f"6. Nullable/default differences: {null_diffs if null_diffs else 'None'}")
    print(f"7. Foreign-key differences: {fk_diffs if fk_diffs else 'None'}")
    print("")
