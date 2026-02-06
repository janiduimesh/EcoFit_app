import pandas as pd
import numpy as np
import xgboost as xgb
import joblib
from pathlib import Path


MODEL_DIR = Path("../models_tax_system")


def load_system():

    try:
        encoders = joblib.load(MODEL_DIR / "encoders.pkl")
        model_excess = xgb.XGBClassifier()
        model_excess.load_model(MODEL_DIR / "xgb_excess.json")
        model_discount = xgb.XGBRegressor()
        model_discount.load_model(MODEL_DIR / "xgb_discount.json")
        model_tax = xgb.XGBRegressor()
        model_tax.load_model(MODEL_DIR / "xgb_tax.json")
        return encoders, model_excess, model_discount, model_tax
    except Exception as e:
        print(f"Error loading models: {e}")
        return None, None, None, None

def generate_invoice(weight, category, income, r4, r12, rate, scenario_name="User Input"):

    encoders, m_excess, m_disc, m_tax = load_system()
    if not encoders: return

    try:
        cat_encoded = encoders['main_waste_category'].transform([category])[0]
        inc_encoded = encoders['income_tier'].transform([income])[0]
    except ValueError:
        print("Error: Invalid Category or Income Tier.")
        return

    input_df = pd.DataFrame({
        'weight_kg': [weight],
        'roll_4w': [r4],
        'roll_12w': [r12],
        'main_waste_category': [cat_encoded],
        'income_tier': [inc_encoded],
        'base_tax_rate': [rate]
    })


    is_excess = m_excess.predict(input_df)[0]
    status = "PENALTY" if is_excess == 1 else "Normal"

    disc_rate = np.clip(m_disc.predict(input_df)[0], 0.0, 1.0)
    final_bill = max(0.0, m_tax.predict(input_df)[0])

    base_cost = weight * rate


    discount_amt = base_cost * disc_rate


    expected_normal_bill = base_cost - discount_amt

    penalty_amt = final_bill - expected_normal_bill

    if penalty_amt < 0.05: penalty_amt = 0.0

    output_row = pd.DataFrame({
        'Scenario': [scenario_name],
        'Category': [category],
        'Weight': [weight],
        'Status': [status],
        'Disc %': [disc_rate],
        'Disc Amt': [discount_amt],
        'Base Cost': [base_cost],
        'FINAL BILL': [final_bill],
        'Penalty Added': [penalty_amt]
    })


    output_row['Disc %'] = (output_row['Disc %'] * 100).map('{:.1f}%'.format)


    money_cols = ['Disc Amt', 'Base Cost', 'FINAL BILL', 'Penalty Added']
    for col in money_cols:
        output_row[col] = output_row[col].map('Rs {:,.2f}'.format)


    pd.set_option('display.max_columns', None)
    pd.set_option('display.width', 1000)

    print("\n" + "=" * 130)
    print(f"{'DETAILED TAX INVOICE':^130}")
    print("=" * 130)
    print(output_row.to_string(index=False))
    print("=" * 130 + "\n")


if __name__ == "__main__":
    generate_invoice(
        weight=20.5,
        category="Inorganic",
        income="low",
        r4=2.1,
        r12=2.4,
        rate=15.0,
        scenario_name="Massive Spike Test"
    )