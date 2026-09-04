# CSV fallback schema

Required header, in order:

```text
entity_id,type,amount,currency,fee,tax,credit,debit,settled,created_at,settled_at,settlement_id,settlement_utr,order_id,order_receipt,payment_id
```

Money fields are integer paise. `currency` must be `INR`; timestamps are Unix seconds.

