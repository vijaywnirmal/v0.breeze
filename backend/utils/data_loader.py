import pandas as pd
import logging
import os

def load_csv(path, **kwargs):
    try:
        df = pd.read_csv(path, **kwargs)
        df = df.fillna("")
        return df
    except Exception as e:
        logging.error(f"Failed to load {path}: {e}")
        return pd.DataFrame()

def load_all_scrips():
    """Load all available scrip CSV files"""
    scrip_files = {
        "NSE": "backend/Scrips/NSEScripMaster.csv",
        "BSE": "backend/Scrips/BSEScripMaster.csv", 
        "NFO": "backend/Scrips/FONSEScripMaster.csv",
        "BFO": "backend/Scrips/FOBSEScripMaster.csv",
        "CDS": "backend/Scrips/CDNSEScripMaster.csv",
    }
    scrip_dfs = {}
    for exch, fname in scrip_files.items():
        scrip_dfs[exch] = load_csv(fname)
    return scrip_dfs

def load_master_csv():
    """Load a default CSV for backward compatibility - use NSE as default"""
    try:
        df = load_csv("backend/Scrips/NSEScripMaster.csv", low_memory=False)
        if not df.empty:
            # Normalize column names
            df.columns = [col.strip().lower() for col in df.columns]
            # Add exchange column if not present
            if 'exchange' not in df.columns:
                df['exchange'] = 'NSE'
        return df
    except Exception as e:
        logging.warning(f"Could not load default CSV, returning empty DataFrame: {e}")
        return pd.DataFrame() 