# VUAG Fantasy Portfolio Tracker: User Guide

This guide explains what the tracker does, how to use every screen, and how to interpret the figures. It is written for someone opening the application for the first time.

> [!IMPORTANT]
> This application is an educational simulation. It does not hold investments, place trades, connect to a broker, submit an HMRC return, or provide financial or tax advice.

## Contents

1. [What the tracker models](#what-the-tracker-models)
2. [Start the application](#start-the-application)
3. [First-time setup](#first-time-setup)
4. [Recommended first visit](#recommended-first-visit)
5. [Dashboard](#dashboard)
6. [Performance](#performance)
7. [Bed & ISA](#bed--isa)
8. [Tax and Excess Reportable Income](#tax-and-excess-reportable-income)
9. [Transactions](#transactions)
10. [Projection](#projection)
11. [Settings](#settings)
12. [What changes the portfolio](#what-changes-the-portfolio)
13. [How the tax estimates work](#how-the-tax-estimates-work)
14. [Market data and refresh behaviour](#market-data-and-refresh-behaviour)
15. [Data storage, backup, and restore](#data-storage-backup-and-restore)
16. [Troubleshooting](#troubleshooting)
17. [Glossary](#glossary)

## What the tracker models

The tracker follows one fantasy investment in Vanguard S&P 500 UCITS ETF (USD) Accumulating:

- London Stock Exchange ticker: `VUAG`
- Yahoo Finance symbol: `VUAG.L`
- ISIN: `IE00BFMXXD54`
- Trading currency used by this application: GBP
- Share class: accumulating

The default opening investment is £100,000:

| Account | Opening amount | UK tax treatment modelled by the app |
| --- | ---: | --- |
| Stocks & Shares ISA | £20,000 | Gains and income are treated as sheltered |
| General Investment Account (GIA) | £80,000 | Gains on disposal and reportable income may be taxable |

The app buys fractional fantasy units, so the entire opening amount can be allocated at the recorded acquisition price.

VUAG is an accumulating fund. The application therefore shows £0 ordinary cash dividends. It separately tracks Excess Reportable Income (ERI), which can create non-cash taxable income in the GIA when entered from official fund documentation.

## Start the application

From the project directory, run:

```bash
docker compose up -d --build
```

Then open [http://localhost:3000](http://localhost:3000).

Check that the service is healthy with:

```bash
docker compose ps
```

The `vuag-portfolio` service should show `healthy`. To view server messages:

```bash
docker compose logs -f vuag-portfolio
```

Press `Ctrl+C` to stop following the logs; this does not stop the application.

## First-time setup

The Dashboard displays **Create the opening acquisition** until the fantasy portfolio has been initialized.

### 1. Choose the start date

The default is 28 August 2026. The start date becomes the date of both opening buys and determines which market price the app requests.

- For a historical date, the app uses that date's available VUAG close or the previous trading close when the selected date is not a trading day.
- For today, the app may use the current delayed quote because a final close may not exist yet.
- Market data comes from Yahoo Finance through the server, never directly from the browser.

### 2. Retrieve and review the price

Leave **Manual price override** blank and select **Retrieve opening price**. Review:

- the GBP price that will be permanently recorded;
- the price date and source;
- whether the value is a current delayed quote;
- the ISA and GIA amounts; and
- the fractional units each account will receive.

If the provider cannot supply a price, enter a positive GBP price in **Manual price override** only after verifying it independently.

### 3. Create the portfolio

Select **Create fantasy portfolio** after reviewing the preview.

This action creates two permanent ledger entries:

- an ISA opening buy; and
- a GIA opening buy.

The acquisition price and units are then locked. Later quotes revalue the units but never rewrite the opening acquisition.

> [!CAUTION]
> There is no reset button in the interface. Initialize only after checking the date, source, price, and allocation. Resetting requires replacing the SQLite database or Docker volume.

## Recommended first visit

After initialization, use the app in this order:

1. Open **Settings** and enter your wider income, capital gains, losses, and ISA allowance already used elsewhere.
2. Check that the displayed tax-year rules match the assumptions you intend to use.
3. Return to **Dashboard** and review the quote source and timestamp.
4. Use **Performance** to inspect historical market movement.
5. Use **Bed & ISA** for a preview before recording any fantasy transfer.
6. Add ERI on **Tax** only when you have the official Vanguard reporting-fund document.
7. Use **Transactions** as the audit trail after any applied change.
8. Use **Projection** only for scenarios, not predictions.

## Dashboard

The Dashboard is the current-state summary.

### Portfolio value

**Portfolio value** is the current VUAG price multiplied by all units held in the ISA and GIA.

| Figure | Meaning |
| --- | --- |
| Initial investment | Total cost of the opening fantasy buys |
| Current value | Current quote multiplied by all units held |
| Gain / loss | Current value minus the stored acquisition/base cost |
| Return | Gain or loss as a percentage of cost |
| Today | Approximate movement using the current quote versus previous close |
| Today % | Today's movement as a percentage |

The market-status line identifies the quote source, timestamp, and whether the quote is normal, stale, or a manual override.

Select **Refresh** to request a fresh quote. A refresh does not alter units, transaction history, or acquisition costs.

### ISA card

The ISA card shows:

- current ISA value;
- VUAG units held;
- average acquisition price;
- gain or loss;
- share of the whole portfolio; and
- £0 tax due within the model because the account is sheltered.

### GIA card

The GIA card shows:

- current GIA value and units;
- original Section 104 pooled cost;
- verified ERI added to allowable base cost;
- adjusted CGT base cost;
- unrealised gain or loss; and
- potential CGT on a hypothetical full disposal.

**Potential CGT is not a current tax bill.** It estimates exposure if the entire GIA were disposed at the displayed price using the saved tax profile and rules.

### Estimated tax exposure card

The large figure is estimated tax crystallised by recorded GIA disposals and verified reportable income. It is different from **Potential CGT**, which is unrealised.

Select **Show potential CGT calculation** to see the values used in the hypothetical calculation.

### Accumulating fund status

The dashboard deliberately reports:

- **Cash dividends: £0**, because VUAG reinvests underlying income; and
- **Awaiting published ERI data** until a verified ERI record has been entered.

The app does not silently treat missing ERI as zero.

## Performance

The Performance page applies actual available historical `VUAG.L` closing prices to the units held.

Select one of the available ranges:

- `1M`, `3M`, or `6M`;
- `YTD`;
- `1Y`, `3Y`, or `5Y`; or
- `ALL`.

The chart separates the ISA, GIA, and combined value. **Period change** compares the first and last available data points in the selected range.

This page contains historical market data only. Forecast values from the Projection page are never inserted into this chart.

If there are no points, initialize the portfolio, select a wider range, or check the market-data troubleshooting section below.

## Bed & ISA

A Bed & ISA is represented as a fantasy sale from the GIA followed by a fantasy purchase in the ISA. The sale can crystallise a capital gain; the new ISA holding is treated as sheltered.

### Preview a transfer

1. Enter a **Transfer amount**.
2. Choose the **Transaction date**.
3. Select **Update preview**.
4. Review the available ISA allowance, units, allocated cost, gain, exemption use, estimated CGT, and resulting account values.
5. Expand **Show gain and tax workings** for the calculation narrative.

The app caps the suggested transfer at the lowest of:

- the requested amount;
- remaining ISA allowance for the selected tax year; and
- current GIA value.

The remaining allowance also deducts **ISA allowance used elsewhere** from Settings and any ISA contributions already recorded by this portfolio in the same tax year.

> [!NOTE]
> The default £20,000 opening ISA buy uses the full configured 2026/27 ISA allowance. A Bed & ISA preview in that same tax year therefore normally shows £0 available. This is intentional, not an error.

### Apply a transfer

Applying is the main user action that changes holdings after setup.

1. Make sure the preview is current.
2. Tick **I understand this records a fantasy GIA disposal and ISA acquisition**.
3. Select **Apply to fantasy portfolio**.

The app records three linked audit rows:

- `GIA_SELL`, which reduces GIA units and crystallises the gain;
- `ISA_BUY`, which adds the same fantasy units to the ISA; and
- `BED_AND_ISA`, an audit-only summary that does not change holdings a second time.

Future dates can be previewed but cannot be applied using today's quote. Projections never apply transfers automatically.

## Tax and Excess Reportable Income

The Tax page groups figures by UK tax year, running from 6 April to 5 April.

Expand a tax year to see:

- GIA disposal proceeds;
- realised gains and entered capital losses;
- annual exemption used;
- taxable capital gain and estimated CGT;
- verified VUAG ERI;
- other dividend income from the tax profile;
- dividend allowance use; and
- estimated reportable-income tax.

Select **Show tax-engine workings** to see the calculation approach and the saved source note for that year's rules.

### Add an ERI record

Only add ERI from the official document for this exact share class and ISIN.

1. Obtain the official Vanguard offshore reporting-fund document.
2. On **Tax**, select **Add ERI record**.
3. Enter the reporting-period start and end.
4. Enter the fund distribution date. This determines the tax year used by the app.
5. Enter ERI per unit in GBP, with up to eight decimal places.
6. Record the official source and document title or URL.
7. Add useful notes, such as the page or table reference.
8. Tick **Verified against the official document** only after checking every field.
9. Select **Save ERI record**.

For a verified record, the app uses the GIA units applicable at the reporting-period end to calculate total ERI. That amount:

- contributes to estimated non-cash reportable income in the distribution date's tax year; and
- increases the GIA's allowable CGT base cost to avoid taxing the same amount again as a capital gain.

An unverified record is stored for reference but is not applied to income tax or base cost. ERI is never applied to the ISA.

> [!CAUTION]
> Saved ERI records cannot currently be edited or deleted in the interface. Check the period, distribution date, amount, source, currency, and verification status before saving.

## Transactions

The Transactions page is the portfolio audit trail. Use the filter to show all entries or one transaction type.

| Type | Meaning |
| --- | --- |
| `INITIAL_BUY` | Opening ISA or GIA acquisition |
| `GIA_SELL` | GIA disposal, normally the sell leg of Bed & ISA |
| `ISA_BUY` | ISA acquisition, normally the buy leg of Bed & ISA |
| `BED_AND_ISA` | Audit-only summary of the two linked legs |
| `ERI` | Verified ERI base-cost adjustment |
| `TAX_PAYMENT` | Reserved transaction category |
| `ADJUSTMENT` | Reserved transaction category |

Important columns include:

- **Gross value**: acquisition cost or disposal proceeds;
- **Cost basis**: allowable cost allocated to the entry;
- **Realised gain**: disposal proceeds minus allocated cost;
- **ERI adjustment**: ERI base cost allocated or added; and
- **Est. tax**: educational estimate attached to that entry.

Ledger entries are append-only in the current interface. Bed & ISA rows remain separate so the GIA and ISA legs can be audited independently.

## Projection

The Projection page is a scenario modeller, not a price forecast.

1. Choose 5, 10, 15, or 20 years.
2. Choose a preset annual total return or enter a custom percentage.
3. Select **Model scenario**.

The output shows hypothetical:

- total portfolio value;
- ISA and GIA values;
- amount progressively sheltered; and
- cumulative estimated tax.

The starting point is labelled **Actual starting point**. Every later row is labelled **Forecast**, and forecast lines are dashed on the chart.

The model compounds the selected return assumption and illustrates annual Bed & ISA transfers using configured/current tax assumptions. It does not predict VUAG prices, market timing, inflation, dealing spreads, platform fees, or future law. It never writes transactions to the ledger.

## Settings

Settings are saved together when you select **Save settings** or **Save all settings**.

### Portfolio assumptions

Before initialization you can configure the start date and opening ISA/GIA amounts. After initialization these fields are locked so saved acquisitions cannot be rewritten.

**Annual Bed & ISA strategy** controls whether transfers can be applied. Disabling it does not remove existing transactions or hide forecast scenarios.

### Market data

**Refresh interval** controls automatic refresh while the dashboard is open and visible. The accepted range is 5 to 1,440 minutes.

Use **Enable manual VUAG price override** for testing or a verified fallback. While enabled:

- the entered GBP price replaces the provider quote for valuation;
- the dashboard clearly labels it as manual; and
- units and acquisition costs remain unchanged.

Disable the override and save again to return to normal provider data.

### Tax profile

The profile describes wider figures that affect the portfolio estimate.

| Field | What to enter |
| --- | --- |
| Tax year | Label in `YYYY/YY` format, for example `2026/27` |
| Employment / pension income | Relevant income outside this portfolio |
| Other taxable income | Other non-dividend taxable income |
| Other dividend income | Dividends/reportable income outside this portfolio |
| Other capital gains | Gains outside this portfolio for the tax year |
| Capital losses | Losses to include in the educational CGT estimate |
| ISA allowance used elsewhere | Contributions to other ISAs that reduce remaining allowance |
| Pension contributions / deductions | Advanced-mode deduction used by the band estimate |
| Personal allowance override | Advanced-mode override; leave blank to use the tax-year rule |

Simple and Advanced modes use the same core profile. Advanced mode exposes the pension/deduction and personal-allowance override fields.

### Tax-year rules

The tax-rule card contains editable assumptions for ISA allowance, CGT exemption and rates, dividend allowance and rates, personal allowance, bands, and thresholds.

Rates are stored as decimals:

- enter `0.18` for 18%;
- enter `0.24` for 24%; and
- do not enter `18` or `24`.

Add a meaningful **Rule source note**. Tick **Treat these rules as confirmed for this tax year** only when you have checked them. Unconfirmed rules are visibly described as projection assumptions.

Future years without their own configured record reuse the latest configured rules as a clearly labelled assumption. The app does not claim those rules are future law.

## What changes the portfolio

| Action | Changes valuation | Changes holdings | Adds ledger entries | Rewrites opening cost |
| --- | --- | --- | --- | --- |
| Refresh market price | Yes | No | No | No |
| Enable manual price | Yes | No | No | No |
| Edit tax profile/rules | Tax estimates only | No | No | No |
| Preview Bed & ISA | Preview only | No | No | No |
| Apply Bed & ISA | Yes | Yes | Yes | No |
| Save unverified ERI | No | No | No | No |
| Save verified ERI | Tax/base-cost figures | No units | Yes | Adds an ERI adjustment |
| Model a projection | No | No | No | No |

## How the tax estimates work

### ISA

The model assigns £0 UK CGT and income tax to gains and income inside the ISA.

### GIA capital gains

For an actual recorded disposal, the app allocates allowable cost using UK share-identification logic in this order:

1. same-day acquisitions;
2. acquisitions during the following 30 days; and
3. the Section 104 pooled holding.

The estimate then combines the portfolio gain with entered wider gains/losses, deducts the available annual exemption, and applies configured CGT rates according to the wider-income profile.

The dashboard's potential CGT uses the same type of calculation for a hypothetical full disposal, but it remains unrealised until a disposal is recorded.

### Reportable income

Verified ERI is treated as potentially taxable non-cash income in the GIA. The estimate accounts for other dividend income, the configured dividend allowance, wider income, and the saved rate bands.

The tax engine is intentionally limited. It does not cover every relief, election, residence issue, personal-allowance taper case, anti-avoidance rule, or filing requirement.

## Market data and refresh behaviour

Normal mode uses Yahoo Finance through the unofficial `yahoo-finance2` package on the server.

- Successful quotes are cached.
- The default automatic refresh interval is 15 minutes.
- Automatic refresh runs only while the dashboard is visible.
- Selecting **Refresh** requests a fresh quote immediately.
- If the provider fails, the app uses the last successful quote and labels it stale.
- If no provider result or cached price exists, the app shows an error instead of inventing a value.

Delayed data can differ from a broker or live exchange feed. Always read the displayed source and timestamp.

## Data storage, backup, and restore

All application data is stored locally in SQLite at `/data/vuag.db` inside the Docker volume named `vuag-fantasy-portfolio-data`.

### Stop without deleting data

```bash
docker compose down
```

Starting the stack again reuses the same database:

```bash
docker compose up -d
```

Do not use `docker compose down -v` unless you intentionally want to delete the portfolio database.

### Create a backup

Stop the service so the SQLite copy is consistent:

```bash
docker compose stop vuag-portfolio
docker run --rm -v vuag-fantasy-portfolio-data:/data -v "$PWD":/backup alpine cp /data/vuag.db /backup/vuag-backup.db
docker compose start vuag-portfolio
```

Confirm that `vuag-backup.db` exists in the project directory and store a copy somewhere safe.

### Restore a backup

> [!WARNING]
> Restoring replaces the current portfolio. Back up the current database first if it may be needed.

With `vuag-backup.db` in the project directory:

```bash
docker compose stop vuag-portfolio
docker run --rm -v vuag-fantasy-portfolio-data:/data -v "$PWD":/backup alpine sh -c 'cp /backup/vuag-backup.db /data/vuag.db && rm -f /data/vuag.db-wal /data/vuag.db-shm && chown 1001:1001 /data/vuag.db'
docker compose start vuag-portfolio
```

Open the Dashboard and Transactions pages to verify the restored state.

## Troubleshooting

### The site does not open

Run:

```bash
docker compose ps
docker compose logs --tail=100 vuag-portfolio
```

If port 3000 is already in use, stop the other service or change the host-side port in `docker-compose.yml`.

### Opening or historical prices are unavailable

- Confirm the machine has internet access.
- Check the container logs for a Yahoo/provider error.
- Try again later because the provider is unofficial.
- Use a verified manual opening price only during first-time setup.
- For ongoing valuation testing, use the labelled manual override in Settings.

### The quote says stale

The live provider failed and the app is using its last successful cached quote. The valuation remains visible, but read the last-successful timestamp before interpreting it.

### Bed & ISA shows £0 available

Check all three allowance consumers:

1. the configured ISA allowance for the selected tax year;
2. ISA contributions already recorded by this portfolio; and
3. **ISA allowance used elsewhere** in Settings.

With the default setup, the £20,000 opening ISA buy has already consumed the 2026/27 allowance.

### A Bed & ISA transfer cannot be applied

Check that:

- the strategy is enabled in Settings;
- the selected date is not in the future;
- remaining ISA allowance and GIA value are greater than zero;
- the confirmation checkbox is ticked; and
- the market quote is available.

### Tax figures look wrong

- Confirm the tax-profile year uses `YYYY/YY` format.
- Check wider income, gains, losses, other dividends, and ISA use.
- Check that rates are decimals, such as `0.18`, not whole percentages.
- Confirm the tax-rule source note and confirmation status.
- Expand the calculation details on Dashboard, Bed & ISA, and Tax.
- Remember that dashboard potential CGT is hypothetical, while crystallised tax requires a recorded disposal.

### ERI is not included

Confirm that the record was saved as verified and that the fund distribution date falls in the tax year being inspected. Unverified records are intentionally not applied.

### Data disappeared after a command

`docker compose down` preserves data. `docker compose down -v` removes the persistent volume and cannot be undone without a backup. Check available volumes with:

```bash
docker volume ls
```

The expected volume is `vuag-fantasy-portfolio-data`.

## Glossary

| Term | Plain-English meaning |
| --- | --- |
| Acquisition price | Price per VUAG unit permanently recorded for a buy |
| Accumulating fund | A fund that reinvests underlying income rather than paying it out as ordinary cash dividends |
| Adjusted CGT base | Original allowable cost plus applicable verified ERI adjustments |
| Annual exemption | Amount of net capital gains covered before CGT in the configured model |
| Bed & ISA | Selling in a taxable account and buying in an ISA to move value into a sheltered account |
| Capital gain | Disposal proceeds minus allowable allocated cost |
| CGT | Capital Gains Tax |
| Crystallised/realised gain | Gain created by a recorded disposal, rather than a movement still held |
| ERI | Excess Reportable Income: potentially taxable non-cash income reported by an offshore reporting fund |
| Fund distribution date | Date used to place ERI into a UK tax year |
| GIA | General Investment Account; treated as taxable by this tracker |
| ISA | Individual Savings Account; treated as tax sheltered by this tracker |
| ISIN | International identifier for a specific security/share class |
| Market value | Current quote multiplied by units held |
| Potential CGT | Hypothetical tax exposure if the GIA were disposed; not automatically tax due |
| Reportable income | Income amount potentially taxable even though an accumulating fund did not pay it as cash |
| Section 104 pool | UK pooled allowable cost used for shares not matched under same-day or 30-day rules |
| Stale quote | Last successful cached price shown because a refresh failed |
| Tax year | UK period from 6 April through 5 April of the following calendar year |
| Unrealised gain | Increase in value while units are still held |

## Final checks before relying on a figure

Before using an output even as an educational estimate, check:

- the market timestamp and source;
- whether the quote is stale or manual;
- the selected tax year;
- the wider tax profile;
- the configured tax rules and source note;
- ISA allowance used elsewhere;
- whether ERI is from the correct official document and share class; and
- whether the figure is realised tax or hypothetical exposure.

For implementation details, development commands, architecture, and known limitations, return to the [project README](../README.md).
