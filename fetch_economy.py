"""Read public FRED observations. No API key, authentication or remote writes."""
import csv
import datetime as dt
import io
import json
import math
import urllib.request
import zipfile

SERIES = ['UNRATE', 'CPIAUCNS', 'PAYEMS', 'A191RL1Q225SBEA', 'DFF', 'DGS10']
URL = 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=' + ','.join(SERIES) + '&cosd=2024-01-01'


def parse_download(data, today=None):
    today = today or dt.datetime.now(dt.timezone.utc).date()
    tables = []
    if data.startswith(b'PK'):
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            entries = archive.infolist()
            if len(entries) > 12 or sum(e.file_size for e in entries) > 16000000:
                raise ValueError('Oversized economic data archive')
            tables = [archive.read(e).decode('utf-8-sig') for e in entries if e.filename.endswith('.csv')]
    else:
        tables = [data.decode('utf-8-sig')]
    series = {key: {} for key in SERIES}
    for table in tables:
        for row in csv.DictReader(io.StringIO(table)):
            try:
                date = dt.date.fromisoformat(row.get('observation_date', row.get('DATE', '')))
            except (ValueError, TypeError):
                continue
            if date > today:
                continue
            for key in SERIES:
                try:
                    value = float(row.get(key, ''))
                    if math.isfinite(value):
                        series[key][date.isoformat()] = value
                except (ValueError, TypeError):
                    pass
    return {key: sorted(values.items()) for key, values in series.items()}


def indicators(series):
    rows = []
    def add(key, label, value, date, basis):
        rows.append({'id': key, 'label': label, 'value': value, 'date': date, 'basis': basis,
                     'source': 'https://fred.stlouisfed.org/series/' + key})
    for key, label in [('UNRATE', 'Unemployment'), ('DFF', 'Fed funds'), ('DGS10', '10Y Treasury')]:
        values = series.get(key, [])
        if values:
            date, value = values[-1]
            add(key, label, value, date, 'monthly rate' if key == 'UNRATE' else 'effective rate' if key == 'DFF' else 'daily yield')
    values = series.get('A191RL1Q225SBEA', [])
    if values:
        date, value = values[-1]
        add('A191RL1Q225SBEA', 'Real GDP growth', value, date, 'quarterly · annualized')
    values = series.get('CPIAUCNS', [])
    if values:
        date, value = values[-1]
        previous = str(int(date[:4]) - 1) + date[4:]
        base = dict(values).get(previous)
        if base is not None and base > 0:
            add('CPIAUCNS', 'CPI inflation', (value / base - 1) * 100, date, 'year over year')
    values = series.get('PAYEMS', [])
    if len(values) > 1:
        date, value = values[-1]
        prior_date, previous = values[-2]
        # Do not label a multi-month gap as a monthly jobs change.
        current_month = int(date[:4]) * 12 + int(date[5:7])
        prior_month = int(prior_date[:4]) * 12 + int(prior_date[5:7])
        if current_month - prior_month == 1:
            add('PAYEMS', 'Payroll jobs', (value - previous) * 1000, date, 'monthly change · seasonally adjusted')
    order = ['A191RL1Q225SBEA', 'CPIAUCNS', 'UNRATE', 'PAYEMS', 'DFF', 'DGS10']
    return sorted(rows, key=lambda row: order.index(row['id']))


def fetch():
    with urllib.request.urlopen(URL, timeout=25) as response:
        data = response.read(3000001)
    if len(data) > 3000000:
        raise ValueError('Oversized economic download')
    rows = indicators(parse_download(data))
    if len(rows) < 4:
        raise ValueError('Economic observations are incomplete')
    return {'version': 1, 'fetchedAt': int(dt.datetime.now(dt.timezone.utc).timestamp() * 1000), 'indicators': rows}


if __name__ == '__main__':
    try:
        print(json.dumps(fetch(), allow_nan=False))
    except Exception:
        # Provider response bodies never become browser content or log messages.
        raise SystemExit('Economic data refresh unavailable')
