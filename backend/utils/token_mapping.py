import pandas as pd
import logging
import os

def build_stock_token_map():
    files = {
        'NSE': 'backend/ScripMaster/ScripMaster - NSEScripMaster.csv',
        'BSE': 'backend/ScripMaster/ScripMaster - BSEScripMaster.csv',
        'NFO': 'backend/ScripMaster/ScripMaster - FONSEScripMaster.csv',
        'BFO': 'backend/ScripMaster/ScripMaster - FOBSEScripMaster.csv',
        'CDS': 'backend/ScripMaster/ScripMaster - CDNSEScripMaster.csv',
    }
    stock_token_map = {}
    for exch, path in files.items():
        try:
            df = pd.read_csv(path)
            for _, row in df.iterrows():
                stock_name = row.get('CompanyName') or row.get('ShortName') or row.get('Symbol') or row.get('ScripName') or row.get('AssetName')
                token = row.get('Token') or row.get('ScripCode') or row.get('AssetToken')
                if stock_name and token is not None:
                    stock_token_map[(str(stock_name).strip().upper(), exch)] = str(token)
        except Exception as e:
            logging.warning(f"Could not load {path}: {e}")
    return stock_token_map

STOCK_TOKEN_MAP = build_stock_token_map()

def get_stock_token(stock_name, exchange=None, fuzzy=False):
    stock_name = str(stock_name).strip().upper()
    results = []
    if exchange:
        key = (stock_name, exchange.upper())
        token = STOCK_TOKEN_MAP.get(key)
        if token:
            results.append({"stock_name": stock_name, "exchange": exchange.upper(), "token": token})
        elif fuzzy:
            for (name, exch), token in STOCK_TOKEN_MAP.items():
                if exch == exchange.upper() and stock_name in name:
                    results.append({"stock_name": name, "exchange": exch, "token": token})
    else:
        for (name, exch), token in STOCK_TOKEN_MAP.items():
            if name == stock_name:
                results.append({"stock_name": name, "exchange": exch, "token": token})
        if not results and fuzzy:
            for (name, exch), token in STOCK_TOKEN_MAP.items():
                if stock_name in name:
                    results.append({"stock_name": name, "exchange": exch, "token": token})
    return results 