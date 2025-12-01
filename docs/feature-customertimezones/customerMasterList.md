# Customer Master List Compilation

This workspace now contains an auto-generated customer master list that merges the Esploro master spreadsheet (`Modified/instClean.csv`) with every `DWH_*_data_orgunit.csv` and `DWH_*_data_academicunit.csv` source on disk.

## Generated assets

- `Modified/customerMasterList.js` &mdash; exports `compiledCustomerMaster`, an array covering 7,212 institutions with the fields requested (sqlName, sfName, customerId, institutionId, server, region, institutionCode, accountCode, city, state, country, timezone).
- `Modified/buildCustomerMaster.js` &mdash; one-shot builder script that parses the CSV sources, merges the data, derives geography/time zone values, and rewrites `customerMasterList.js`.

## Regenerating the data

Run the builder whenever the CSV inputs change:

```pwsh
cd "c:\Users\U6071248\SQL Files\TIMEZONES"
node Modified\buildCustomerMaster.js
```

The script logs the number of compiled institutions and overwrites `customerMasterList.js` with the latest snapshot.

## Data and mapping rules

- `sqlName` comes from the DWH org-unit `NAME` column with a fallback to the Salesforce account name when the SQL value is missing.
- `sfName` is taken from the master list (`Account Name`, falling back to `Account Name Internal`).
- `accountCode` maps to the academic `BASE_CODE` (e.g., `65SUTD_INST`).
- `institutionCode` maps to the org-unit `ORG_CODE`, automatically stripping the `_INST` suffix when only the academic value exists.
- `server` is derived from `DB_SERVER` (characters between `DWH_` and `_A_RO`) and lower-cased; `region` is the first two characters of that code.
- Geography fields prefer the master list values; when a value is missing it is set to `"Unknown"` to keep the record complete.
- Time zone resolution order: `ORG_TIMEZONE` from DWH &rarr; state/province-specific lookup (US/CA/AU) &rarr; country-level default &rarr; server-region fallback &rarr; `"Unknown"`.

## Known limitations

- Not every DWH record has a matching entry in the Salesforce master sheet, so a subset of `sfName` and geography fields remain `"Unknown"`.
- The time zone derivation uses curated defaults and may not match institutions that operate across multiple time zones.
- The builder scans the entire `TIMEZONES` workspace; keep unnecessary CSVs out of the tree or rename them to avoid accidental ingestion.
